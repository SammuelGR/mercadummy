# Reprocessamento do MongoDB

Instruções para reconstruir ou corrigir as views. Os documentos, índices, consultas de carga e a função de gravação estão em `04-modelagem-mongodb.md`.

> Os comandos e ferramentas de aplicação citados aqui ainda **precisam ser implementados** junto com a API.

## Princípio

As views são refeitas a partir do **estado atual do PostgreSQL**, e não do histórico de eventos. Não se trata de Event Sourcing.

Isso depende de três garantias:

1. Toda criação, alteração ou exclusão de categoria, produto ou pedido grava um evento **na mesma transação**, inclusive em correções feitas direto no banco.
2. Toda alteração incrementa a `version`.
3. Todo dado de uma view existe no PostgreSQL ou é calculado a partir dele.

O reprocessamento não altera dados de negócio nem acessa o Redis. Eventos já processados não são necessários. **Nunca apague eventos pendentes.**

## Qual caminho usar

| Situação | Caminho |
|---|---|
| MongoDB apagado ou perdido | **B** é o mais simples; **A** evita um catálogo preenchido aos poucos |
| Mudou o formato de um documento ou um cálculo | **A**; B funciona, mas mistura formatos durante o processo |
| Há documentos que não deveriam existir | **A** |
| O PostgreSQL foi restaurado de um backup, ou recarregado com ids novos | **A**, obrigatoriamente |
| Um ou poucos registros divergentes, com ids conhecidos | **B** para esses registros |
| Mudou somente um índice | criar ou recriar o índice; não é preciso reprocessar |

Após restaurar o PostgreSQL, o MongoDB pode ter versões **maiores**, que a regra de gravação não substitui, ou documentos com outros ids. Em categorias com ids novos, o índice único de `slug` também causaria erro.

Antes de qualquer caminho, **corrija a causa** do problema. Reprocessar com o mesmo erro no código repete o resultado.

## A trava entre worker e reconstrução

Os dois usam uma trava consultiva (*advisory lock*) do PostgreSQL com a chave `727001`, um número fixo escolhido para este fim. Não exige tabela nova.

| Processo | Trava | Efeito |
|---|---|---|
| Worker | compartilhada, por transação, sem esperar | pula o ciclo se houver reconstrução |
| Reconstrução | exclusiva, por sessão, com espera | espera o lote em andamento e impede novos |

O worker precisa obter a trava em **todo** ciclo, antes de selecionar eventos (`worker-lock`). Ela é liberada no fim da transação. Duas reconstruções também não rodam ao mesmo tempo.

A API continua gravando no PostgreSQL durante a reconstrução. Os eventos se acumulam e são processados depois.

## Caminho A: reconstrução com coleções temporárias

Comando proposto na aplicação: `projections:rebuild`, para uma coleção ou para todas. Ele usa a **mesma função de transformação** do worker.

Use **uma única conexão** com o PostgreSQL do passo 1 ao 8. Não use uma conexão diferente do pool a cada comando.

### 1. Obter a trava

Fora de qualquer transação:

```sql
-- rebuild-lock
SELECT pg_advisory_lock(727001);
```

### 2. Preparar as coleções temporárias

- Apagar sobras de execuções anteriores: `categories_rebuild`, `products_rebuild` e `orders_rebuild`.
- Criar as coleções temporárias **com seus índices**, mesmo que a tabela de origem esteja vazia.

### 3. Abrir uma leitura consistente

```sql
-- rebuild-begin
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
```

A ordem dos passos 1 e 3 é importante. O PostgreSQL fixa a visão dos dados na primeira consulta da transação. Se a trava fosse pedida dentro dela, essa visão poderia ser anterior ao término do último lote do worker.

### 4. Copiar em lotes

Para cada coleção, buscar os ids em lotes, começando com `00000000-0000-0000-0000-000000000000`:

```sql
-- rebuild-ids-categories
SELECT id FROM categories WHERE id > $1 ORDER BY id LIMIT 500;
```

```sql
-- rebuild-ids-products
SELECT id FROM products WHERE id > $1 ORDER BY id LIMIT 500;
```

```sql
-- rebuild-ids-orders
SELECT id FROM orders WHERE id > $1 ORDER BY id LIMIT 500;
```

Carregar cada lote com a consulta `load-*` correspondente, transformar e inserir na coleção temporária. O último id do lote é o parâmetro do próximo. Pare quando não vier nenhum id.

Qualquer erro **interrompe** a reconstrução; nenhum documento é ignorado.

### 5. Conferir e encerrar a leitura

Ainda na mesma transação, a quantidade em cada coleção temporária reconstruída deve ser **igual** à da tabela:

```sql
-- rebuild-counts
SELECT (SELECT count(*) FROM categories) AS categories,
       (SELECT count(*) FROM products)   AS products,
       (SELECT count(*) FROM orders)     AS orders;
```

Um pedido sem itens não é retornado por `load-order` e fará essa conferência falhar. Ele viola uma regra da aplicação e precisa ser investigado.

```sql
-- rebuild-commit
COMMIT;
```

Se o `COMMIT` ou a conexão falhar, **não faça a troca**: a trava pode ter sido perdida.

### 6. Trocar as coleções

Renomear somente as coleções reconstruídas:

```js
for (const name of ['categories', 'products', 'orders']) {
  await db.collection(`${name}_rebuild`).rename(name, { dropTarget: true });
}
```

Cada troca substitui a coleção antiga e leva os índices da temporária. **As três trocas não formam uma operação única**, e consultas em andamento podem ser interrompidas.

### 7. Reativar eventos que esgotaram as tentativas

```sql
-- retry-failed
UPDATE outbox_events
SET attempts = 0, last_error = NULL
WHERE processed_at IS NULL AND attempts >= 10;
```

### 8. Liberar a trava

```sql
-- rebuild-unlock
SELECT pg_advisory_unlock(727001);
```

O worker volta a processar os eventos pendentes. Alguns já podem estar refletidos na cópia; processá-los de novo é seguro. O que mudou depois do início da leitura é aplicado agora. Isso inclui registros novos, mesmo que seu UUID fique "antes" do lote já copiado.

### Se algo falhar

| Momento | Estado | O que fazer |
|---|---|---|
| Antes das trocas | coleções atuais intactas | encerrar a transação, liberar a trava, corrigir e executar de novo |
| Entre as trocas | parte das coleções é nova | executar o comando de novo, do início |
| O processo caiu | o PostgreSQL libera a trava quando percebe o fim da conexão | executar de novo; o passo 2 limpa as sobras |

Se o comando continuar em execução após um erro, ele deve fazer `ROLLBACK` e liberar a trava, ou fechar a conexão.

## Caminho B: recolocar registros na fila

O próprio worker reprocessa. Não usa coleções temporárias nem pausa.

1. Confirmar que o worker roda o código correto.
2. **Criar os índices** antes, principalmente se o MongoDB foi apagado.
3. Inserir os eventos.

**Todos os registros:**

```sql
-- requeue-all
INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type)
SELECT 'CATEGORY', id, 'ReprocessRequested' FROM categories
UNION ALL
SELECT 'PRODUCT', id, 'ReprocessRequested' FROM products
UNION ALL
SELECT 'ORDER', id, 'ReprocessRequested' FROM orders;
```

Para refazer só uma coleção, use apenas o `SELECT` correspondente.

**Um registro** (parâmetros: tipo e id):

```sql
-- requeue-one
INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type)
VALUES ($1, $2, 'ReprocessRequested');
```

Se o id não existir mais no PostgreSQL, o worker apaga o documento correspondente.

4. Se houver eventos que esgotaram as tentativas, executar `retry-failed`.
5. Acompanhar até não restarem pendências.

Limitações:

- Os novos eventos entram no fim da fila e podem atrasar atualizações feitas depois.
- Em um MongoDB vazio, as telas se preenchem aos poucos.
- Documentos cujo id não está mais no PostgreSQL não são encontrados por `requeue-all`.
- Não substitui documentos com versão maior que a do PostgreSQL.

## Acompanhamento

```sql
-- monitor
SELECT count(*) FILTER (WHERE attempts < 10)   AS pending,
       count(*) FILTER (WHERE attempts >= 10)  AS failed,
       min(occurred_at)                        AS oldest
FROM outbox_events
WHERE processed_at IS NULL;
```

`failed` maior que zero exige análise de `last_error`. Corrija a causa antes de executar `retry-failed`.

## Conferência final

Faça com a fila zerada e, de preferência, sem novas escritas. Compare os pares id e versão das três coleções.

```sql
-- verify-categories
SELECT id, version FROM categories ORDER BY id;
```

```sql
-- verify-products
SELECT id, version FROM products ORDER BY id;
```

```sql
-- verify-orders
SELECT id, version FROM orders ORDER BY id;
```

No MongoDB, para cada coleção:

```js
await db.collection(name).find({}, { projection: { version: 1 } }).sort({ _id: 1 }).toArray();
```

As duas listas devem ter os mesmos ids e versões. Confira também os índices e abra alguns documentos. A comparação **não detecta** um cálculo errado quando id e versão estão corretos.

## Durante o reprocessamento

| Parte do sistema | Efeito |
|---|---|
| Catálogo, categorias e histórico | no caminho A, dados antigos até as trocas; no B, atualização gradual; com o MongoDB apagado, vazios ou incompletos |
| Carrinho | pode mostrar itens como indisponíveis; **a leitura nunca os apaga** |
| Checkout | a API continua validando no PostgreSQL, mas o front pode impedir a compra se o carrinho mostrar itens indisponíveis |
| Sessões | não são afetadas |

## Teste recomendado para o protótipo

Quando a API estiver pronta:

1. Fazer a migração e criar pedidos de teste, com um já entregue.
2. Guardar uma cópia dos documentos.
3. Apagar o banco do MongoDB.
4. Reconstruir pelo caminho A e comparar com a cópia.
5. Repetir pelo caminho B.
6. Repetir o caminho A enquanto novas compras são feitas, e conferir após a fila zerar.
