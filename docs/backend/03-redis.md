# Redis: sessão e carrinho

## Papel no sistema

O Redis guarda **somente sessões e carrinhos**.

- Ele é o único lugar onde esses dois dados existem. Não é uma cópia do PostgreSQL.
- Ele não é cache de catálogo. Os dados de produto são lidos do MongoDB.
- Ele não participa da outbox nem da reconstrução das views.
- Só a API acessa o Redis.

## Chaves

| Chave | Tipo | Conteúdo | Validade |
|---|---|---|---|
| `session:{sessionId}` | hash | `userId`, `fullName`, `role` | 24 horas a partir do login, sem renovação |
| `cart:{userId}` | hash | campo `productId`, valor `quantity` | 7 dias a partir da última operação de escrita |

`userId` e `productId` são os UUIDs do PostgreSQL. No Redis, todos os valores dos hashes são armazenados como texto.

## Sessão

### Identificador

O `sessionId` funciona como uma credencial. Gere **32 bytes aleatórios** com um gerador criptográfico e codifique em `base64url`. No Node.js: `crypto.randomBytes(32).toString('base64url')`.

Não registre o `sessionId` em logs.

### Campos

| Campo | Exemplo | Uso |
|---|---|---|
| `userId` | `7f1c2a9e-4b3d-4c8a-9f21-6d5e8b0a1c34` | identificar o usuário em toda operação |
| `fullName` | `Maria Souza` | resposta de `GET /auth/me` |
| `role` | `user` ou `admin` | autorização |

E-mail, senha e hash de senha não são gravados.

`fullName` e `role` são cópias feitas no login. Se no futuro for possível alterar o papel ou remover um usuário, será necessário encerrar as sessões dele. Isso exigirá um índice de sessões por usuário, que não existe nesta versão.

### Cookie

| Atributo | Valor |
|---|---|
| Nome | `sid` |
| Conteúdo | somente o `sessionId` |
| `HttpOnly` | sim |
| `Secure` | sim; pode ser desligado apenas no ambiente local sem HTTPS |
| `SameSite` | `Lax` |
| `Path` | `/` |
| `Max-Age` | `86400` |

- O front envia as requisições com `credentials: 'include'`. No CORS, a API informa a origem exata do front (não use `*`) e `Access-Control-Allow-Credentials: true`.
- Nas operações de escrita, a API recusa um cabeçalho `Origin` diferente do esperado. Requisições sem `Origin`, como as do script de migração, são aceitas e continuam exigindo a autenticação de cada rota.
- `SameSite=Lax` pressupõe front e API no mesmo *site*. Se forem publicados em sites diferentes, o cookie precisa ser revisto.

### Operações

**Criar** (login e cadastro). Os dois comandos vão na mesma transação para a chave nunca ficar sem validade.

```redis
MULTI
HSET session:{sessionId} userId {userId} fullName {fullName} role {role}
EXPIRE session:{sessionId} 86400
EXEC
```

- Gere sempre um `sessionId` novo. Nunca reaproveite um valor recebido do navegador.
- Se a requisição já trouxer um cookie de sessão, apague a sessão anterior.
- No cadastro, grave primeiro o usuário no PostgreSQL e depois crie a sessão. Se o Redis falhar, a conta continua criada e o usuário precisa fazer login.
- O mesmo usuário pode ter várias sessões, uma por navegador.

**Validar** (rotas que exigem sessão):

```redis
HGETALL session:{sessionId}
```

Sem cookie ou com resultado vazio, responda `401 UNAUTHENTICATED`. Não altere o hash depois de criado: um `HSET` após a expiração recriaria a chave **sem validade**.

**Encerrar** (logout):

```redis
DEL session:{sessionId}
```

A API também expira o cookie. O carrinho é mantido.

## Carrinho

Só usuários autenticados têm carrinho. O `userId` vem **sempre da sessão**, nunca do corpo ou da URL.

### Estrutura

```redis
HGETALL cart:7f1c2a9e-4b3d-4c8a-9f21-6d5e8b0a1c34
1) "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61"
2) "2"
3) "e8d3c7b1-6a24-4f0d-b95a-1c7e4f2a8d90"
4) "1"
```

- A quantidade é um inteiro maior que zero.
- Nome, preço, imagem, desconto e totais **não** são gravados.
- Carrinho vazio é chave inexistente: o Redis remove o hash quando o último campo é apagado.
- Ler o carrinho não renova a validade.

### Adicionar: `POST /cart/items`

A quantidade enviada é **somada** à que já está no carrinho.

1. Validar que a quantidade é um inteiro maior que zero.
2. Buscar o produto no MongoDB. Se não existir ou estiver inativo, responder `404 PRODUCT_NOT_FOUND`.
3. Executar o script, informando o estoque lido. A conferência e a gravação ficam em uma única operação.

```lua
-- cart-add
-- KEYS[1] = cart:{userId}
-- ARGV = productId, quantidade, estoque, validade em segundos
local atual = tonumber(redis.call('HGET', KEYS[1], ARGV[1]) or '0')
local nova = atual + tonumber(ARGV[2])
if nova > tonumber(ARGV[3]) then
  return -1
end
redis.call('HSET', KEYS[1], ARGV[1], nova)
redis.call('EXPIRE', KEYS[1], ARGV[4])
return nova
```

Retorno `-1`: responder `409 INSUFFICIENT_STOCK`. A validade é `604800`.

### Alterar quantidade: `PUT /cart/items/:productId`

A quantidade enviada **substitui** a atual. Antes do script, validar que é um inteiro maior que zero, que o produto está ativo e que não passa do estoque. Para remover, use `DELETE`.

```lua
-- cart-set
-- KEYS[1] = cart:{userId}
-- ARGV = productId, quantidade, validade em segundos
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 0 then
  return 0
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
```

Retorno `0`: o item não está no carrinho; responder `404 CART_ITEM_NOT_FOUND`. Assim, uma alteração atrasada não recria um item já removido.

### Remover: `DELETE /cart/items/:productId`

```redis
MULTI
HDEL cart:{userId} {productId}
EXPIRE cart:{userId} 604800
EXEC
```

Remover um item ausente não é erro. Se o carrinho ficar vazio, o `EXPIRE` não tem efeito.

### Ler: `GET /cart`

1. `HGETALL cart:{userId}`.
2. Buscar todos os produtos no MongoDB em uma única consulta por `_id`.
3. Montar cada item com `productId`, `title`, `thumbnail`, `price`, `quantity` e `stock`.
4. Calcular `totalQuantity` (soma das quantidades) e `total` (soma de `price × quantity`, a preço cheio) com aritmética decimal.

O Redis não garante a ordem dos campos do hash. A API ordena os itens por `title` e `productId`; itens sem produto encontrado vão para o final.

O contador do cabeçalho é o `totalQuantity` desta resposta. Não há uma rota só para ele.

O carrinho pode conter um item que deixou de estar disponível. Nesse caso, o item é devolvido com o campo `issue`:

| Situação | `issue` | Entra no `total` |
|---|---|---|
| Produto inativo ou não encontrado no MongoDB | `PRODUCT_UNAVAILABLE` | não |
| Quantidade maior que o estoque | `INSUFFICIENT_STOCK` | sim |

- Com qualquer `issue`, o front impede o checkout até o usuário ajustar o carrinho.
- Um item sem produto encontrado vem apenas com `productId`, `quantity` e `issue`. Ele continua contando em `totalQuantity` e pode ser removido.
- **A leitura nunca apaga itens.** Durante uma reconstrução do MongoDB, um produto pode estar temporariamente ausente.
- Se o MongoDB estiver fora do ar, responda com erro, sem alterar o carrinho.

O estoque do MongoDB pode estar atrasado. A validação do carrinho serve para orientar o usuário; a **validação definitiva é a do checkout, no PostgreSQL**.

## Checkout: `POST /orders`

O front gera um UUID `idempotencyKey` ao abrir o checkout e reenvia o mesmo valor nas novas tentativas. A chave é guardada no PostgreSQL, não no Redis.

1. Validar a sessão.
2. Procurar no PostgreSQL um pedido com o mesmo usuário e `idempotencyKey`. Se existir, limpar o carrinho com os itens dele (passo 5) e devolver esse pedido.
3. Ler o carrinho. Se estiver vazio, responder `409 CART_EMPTY`.
4. Em uma transação no PostgreSQL, validar e baixar o estoque, usar os preços do PostgreSQL e gravar pedido, itens e outbox. Se a transação falhar **por qualquer motivo**, repetir a busca do passo 2 antes de responder com erro.
5. Após o commit, remover do carrinho os itens comprados.

O passo 2 vem antes da leitura porque, em uma nova tentativa, o carrinho pode já estar vazio. A nova busca no passo 4 cobre duas requisições simultâneas com a mesma chave: a segunda pode falhar por chave duplicada ou por falta de estoque, embora o pedido já exista.

### Limpeza do carrinho

O script remove um item **somente se a quantidade ainda for igual à comprada**. Itens adicionados ou alterados durante o processamento são mantidos.

```lua
-- cart-checkout-cleanup
-- KEYS[1] = cart:{userId}
-- ARGV = pares productId, quantidade comprada
local removidos = 0
for i = 1, #ARGV, 2 do
  if redis.call('HGET', KEYS[1], ARGV[i]) == ARGV[i + 1] then
    removidos = removidos + redis.call('HDEL', KEYS[1], ARGV[i])
  end
end
return removidos
```

- Se um item teve a quantidade alterada durante a compra, ele permanece com a nova quantidade inteira.
- A limpeza não renova a validade.
- Se a limpeza falhar, o pedido **continua válido**: registre o erro e responda com sucesso. Os itens podem permanecer no carrinho.
- Repetir o script logo em seguida não remove nada a mais. A exceção é o usuário ter adicionado de novo o mesmo produto, na mesma quantidade, entre as duas execuções.

## Falhas

| Situação | Efeito esperado |
|---|---|
| Redis fora do ar | login, cadastro, carrinho e rotas com sessão respondem `503`; o catálogo público continua, sem consultar a sessão |
| Dados do Redis perdidos | usuários fazem login novamente e os carrinhos se perdem; pedidos não são afetados |
| Memória esgotada com `noeviction` | escritas que precisam de memória retornam erro; chaves não são descartadas para abrir espaço |

Falha de conexão não deve ser tratada como sessão inexistente (`401`) nem como carrinho vazio.

## Configuração

| Opção | Valor | Motivo |
|---|---|---|
| `appendonly` | `yes` | recuperar sessões e carrinhos após reiniciar |
| `appendfsync` | `everysec` | grava em disco a cada segundo; uma queda pode perder as escritas mais recentes |
| `maxmemory-policy` | `noeviction` | não descartar sessões ou carrinhos sem aviso; definir explicitamente, pois o padrão pode variar em serviços gerenciados |

```bash
redis-server --appendonly yes --appendfsync everysec --maxmemory-policy noeviction
```

- Em contêiner, o diretório de dados precisa estar em um volume persistente.
- Não exponha a porta do Redis publicamente. Fora do ambiente local, exija autenticação.
- O endereço e a senha vêm de variáveis de ambiente.

A expiração continua valendo com `noeviction`: chaves vencidas são removidas normalmente.

## Limitações conhecidas

| Situação | Consequência | Solução possível, não incluída |
|---|---|---|
| Duas abas confirmam o checkout ao mesmo tempo, com chaves diferentes | podem ser criados dois pedidos, se houver estoque | trava por usuário, por exemplo `checkout:lock:{userId}` |
| O carrinho muda depois que o usuário revisou o checkout | o pedido usa o carrinho do momento da confirmação | enviar os itens e o total esperados e recusar se houver diferença |
| O preço muda depois da revisão | o pedido usa o preço atual do PostgreSQL | enviar o total esperado e recusar se houver diferença |

## Ponto de atenção: compra duplicada

Se duas abas confirmarem a compra ao mesmo tempo, com chaves de idempotência diferentes, **podem ser criados dois pedidos**, desde que haja estoque. A `idempotencyKey` só evita a repetição de requisições com a mesma chave.

Uma trava por usuário no Redis evitaria essa situação. Ela **não faz parte do desenho atual** e fica registrada para avaliação, caso o protótipo precise de proteção contra compra duplicada.
