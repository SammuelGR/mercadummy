# Modelagem MongoDB

O MongoDB guarda as **views de leitura**, no formato das telas. Ele não é fonte da verdade: todo o conteúdo vem do PostgreSQL ou é calculado a partir dele. Só o processo de projeção grava nas views.

As instruções para reconstruir ou corrigir as views estão em `05-reprocessamento-mongodb.md`.

## Visão geral

Banco: `mercadummy`.

| Coleção | Um documento por | Telas e uso | Origem no PostgreSQL |
|---|---|---|---|
| `products` | produto | catálogo, detalhe, carrinho | `products`, `categories` |
| `categories` | categoria | filtro do catálogo | `categories` |
| `orders` | pedido, com os itens | histórico e consulta do admin | `orders`, `order_items` |

Usuários e outbox **não** são projetados. Sessões e carrinhos ficam no Redis.

## Convenções

| Tema | Regra |
|---|---|
| Identificadores | UUID v4 como **texto** em minúsculas; o `_id` é o `id` do PostgreSQL |
| Nomes dos campos | camelCase, seguindo o DummyJSON quando houver campo equivalente |
| Dinheiro | `Decimal128`, criado a partir do texto do `numeric`; a API devolve número |
| Datas | `Date`, em UTC, com precisão de milissegundos; o front exibe no fuso local |
| Relacionamentos | dados necessários à tela são copiados no documento; não há `$lookup` |
| `version` | cópia da `version` do PostgreSQL |

O texto foi escolhido para os UUIDs por facilitar a leitura no protótipo. O tipo binário de UUID ocupa menos espaço.

## Coleção `products`

```json
{
  "_id": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61",
  "title": "Essence Mascara Lash Princess",
  "titleSearch": "essence mascara lash princess",
  "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
  "category": { "id": "4c1f8b2e-9a07-4d5c-b3e6-0f2a7c9d1b48", "slug": "beauty", "name": "Beauty" },
  "price": { "$numberDecimal": "9.99" },
  "discountPercentage": 10,
  "stock": 99,
  "availabilityStatus": "In Stock",
  "rating": 2.56,
  "description": "The Essence Mascara Lash Princess is a popular mascara...",
  "images": ["https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/1.webp"],
  "specifications": [
    { "label": "Brand", "value": "Essence" },
    { "label": "SKU", "value": "BEA-ESS-ESS-001" },
    { "label": "Weight", "value": "4" },
    { "label": "Dimensions (W × H × D)", "value": "15.14 × 13.08 × 22.99" },
    { "label": "Warranty", "value": "1 week warranty" },
    { "label": "Shipping", "value": "Ships in 3-5 business days" },
    { "label": "Return Policy", "value": "No return policy" }
  ],
  "isActive": true,
  "createdAt": { "$date": "2026-11-25T18:00:00.000Z" },
  "version": 1
}
```

| Campo | Tipo | Origem no PostgreSQL | Transformação |
|---|---|---|---|
| `_id` | string | `products.id` | direta |
| `title` | string | `products.title` | direta |
| `titleSearch` | string | `products.title` | normalizado para a busca |
| `thumbnail` | string | `products.thumbnail` | direta |
| `category.id` | string | `categories.id` | embutido |
| `category.slug` | string | `categories.slug` | embutido |
| `category.name` | string | `categories.name` | embutido |
| `price` | Decimal128 | `products.price` | preço cheio |
| `discountPercentage` | int | `products.discount_percentage` | arredondado: 10.48 → 10; 10.50 → 11 |
| `stock` | int | `products.stock` | direta |
| `availabilityStatus` | string | `products.stock` | calculado |
| `rating` | double | `details.rating` | omitido se ausente |
| `description` | string | `details.description` | `""` se ausente |
| `images` | array de string | `details.images` | `[]` se ausente; mantém a ordem |
| `specifications` | array | `details` | ver abaixo |
| `isActive` | bool | `products.is_active` | direta |
| `createdAt` | date | `products.created_at` | usado na ordenação do catálogo |
| `version` | int | `products.version` | direta |

Não são projetados: `external_id`, `updated_at` e, de `details`, `tags`, `reviews`, `minimumOrderQuantity` e `meta`.

### Campos calculados

**`titleSearch`**: sem acentos e em minúsculas. O termo buscado passa pela mesma função.

```js
const normalize = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
```

**`discountPercentage`**: `Math.round` sobre o valor do banco. O arredondamento é só para exibição; os cálculos usam o valor exato do PostgreSQL. Quando o resultado é 0, o front oculta o selo.

**`availabilityStatus`** (regra proposta; a fronteira entre 7 e 8 não é consistente nos dados do DummyJSON):

| `stock` | Valor |
|---|---|
| 0 | `Out of Stock` |
| 1 a 7 | `Low Stock` |
| 8 ou mais | `In Stock` |

**`specifications`**: pares `label` e `value`, ambos texto, nesta ordem. Itens ausentes são omitidos.

| Chave em `details` | `label` | `value` |
|---|---|---|
| `brand` | `Brand` | o texto |
| `sku` | `SKU` | o texto |
| `weight` | `Weight` | o número, sem unidade |
| `dimensions` | `Dimensions (W × H × D)` | `width × height × depth`; só se os três existirem |
| `warrantyInformation` | `Warranty` | o texto |
| `shippingInformation` | `Shipping` | o texto |
| `returnPolicy` | `Return Policy` | o texto |

Produtos inativos **continuam na coleção**, com `isActive: false`. O catálogo e o detalhe os escondem, e o carrinho os usa para avisar que o item está indisponível.

## Coleção `categories`

```json
{ "_id": "4c1f8b2e-9a07-4d5c-b3e6-0f2a7c9d1b48", "slug": "beauty", "name": "Beauty", "version": 1 }
```

| Campo | Tipo | Origem no PostgreSQL |
|---|---|---|
| `_id` | string | `categories.id` |
| `slug` | string | `categories.slug` |
| `name` | string | `categories.name` |
| `version` | int | `categories.version` |

`updated_at` não é projetado.

## Coleção `orders`

```json
{
  "_id": "9d3e7a15-2c84-4b6f-a0d9-5e1f8c4b7a23",
  "orderNumber": 1001,
  "userId": "7f1c2a9e-4b3d-4c8a-9f21-6d5e8b0a1c34",
  "status": "PROCESSING",
  "createdAt": { "$date": "2026-11-25T18:32:00.000Z" },
  "totalQuantity": 2,
  "total": { "$numberDecimal": "19.98" },
  "items": [
    {
      "productId": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61",
      "title": "Essence Mascara Lash Princess",
      "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
      "price": { "$numberDecimal": "9.99" },
      "quantity": 2
    }
  ],
  "version": 1
}
```

| Campo | Tipo | Origem no PostgreSQL |
|---|---|---|
| `_id` | string | `orders.id` |
| `orderNumber` | int | `orders.order_number`, exibido como "Pedido #1001" |
| `userId` | string | `orders.user_id` |
| `status` | string | `orders.status` |
| `createdAt` | date | `orders.created_at` |
| `totalQuantity` | int | `orders.total_quantity` |
| `total` | Decimal128 | `orders.total`, a preço cheio |
| `items[].productId` | string | `order_items.product_id` |
| `items[].title` | string | `order_items.title` |
| `items[].thumbnail` | string | `order_items.thumbnail` |
| `items[].price` | Decimal128 | `order_items.price` |
| `items[].quantity` | int | `order_items.quantity` |
| `version` | int | `orders.version` |

- Os itens usam os valores **da compra**. Mudar um produto não altera os pedidos antigos.
- Os itens são ordenados por `title` e `productId`. Com UUID v4, o id não indica a ordem de inserção, e `order_items` não tem coluna de posição.
- Não são projetados: `discounted_total`, `total_products`, `idempotency_key`, `updated_at`, nem o desconto e os totais por item.

## Índices

Além do índice automático em `_id`:

| Coleção | Nome | Chaves | Uso |
|---|---|---|---|
| `products` | `catalog` | `{ isActive: 1, createdAt: 1, _id: 1 }` | catálogo paginado |
| `products` | `catalog_by_category` | `{ isActive: 1, "category.slug": 1, createdAt: 1, _id: 1 }` | filtro por categoria |
| `categories` | `slug_unique` | `{ slug: 1 }`, único | slug sem repetição |
| `orders` | `by_user` | `{ userId: 1, createdAt: -1, _id: -1 }` | histórico do usuário |
| `orders` | `by_status` | `{ status: 1, createdAt: -1, _id: -1 }` | admin com filtro |
| `orders` | `by_date` | `{ createdAt: -1, _id: -1 }` | admin sem filtro |

A definição dos índices fica em **um único lugar no código**. A aplicação os cria na inicialização, e a reconstrução usa a mesma definição.

## Consultas por tela

| Tela ou operação | Consulta |
|---|---|
| Filtro de categorias | `db.categories.find().sort({ name: 1 })` |
| Catálogo | ver abaixo |
| Detalhe do produto | `db.products.findOne({ _id: id, isActive: true })`; sem resultado, `404` |
| Carrinho | `db.products.find({ _id: { $in: ids } })`, incluindo inativos |
| Histórico | `db.orders.find({ userId }).sort({ createdAt: -1, _id: -1 })` |
| Admin | `db.orders.find({ status }).sort({ createdAt: -1, _id: -1 })`; sem filtro, `find({})` |

No histórico, o `userId` vem **sempre da sessão**. A consulta do admin exige o papel `admin`.

O carrinho usa `title`, `thumbnail`, `price`, `stock` e `isActive`.

### Catálogo e Load More

A ordem é `createdAt` e, no empate, `_id`. Com UUID v4, ordenar só por `_id` misturaria os produtos sem critério. Assim, produtos criados depois tendem a entrar no fim da lista.

```js
const filter = { isActive: true };
if (category) filter['category.slug'] = category;
if (inStock) filter.stock = { $gt: 0 };            // inclui Low Stock
if (search) filter.titleSearch = { $regex: escapeRegex(normalize(search)) };
if (cursor) {
  filter.$or = [
    { createdAt: { $gt: cursor.createdAt } },
    { createdAt: cursor.createdAt, _id: { $gt: cursor.id } },
  ];
}

const docs = await db.collection('products')
  .find(filter)
  .sort({ createdAt: 1, _id: 1 })
  .limit(limit + 1)
  .toArray();
```

- Se vierem `limit + 1` documentos, devolver os primeiros `limit` e gerar `nextCursor` com `createdAt` e `_id` do último devolvido. Caso contrário, `nextCursor` é `null`.
- Para a API, o cursor é um texto opaco, por exemplo o JSON em `base64url`. A API valida seu conteúdo antes de montar o filtro e converte `createdAt` de volta para `Date`.
- Mudar a busca ou um filtro descarta o cursor.
- `escapeRegex` é obrigatório, e `limit` precisa ter um máximo. Os valores estão em `06-contrato-api.md`.
- A busca por trecho não aproveita bem um índice. Para o volume do protótipo, é suficiente.

## Projeção: como as views são atualizadas

O worker consome `outbox_events`. Para decidir o que fazer, usa somente `aggregate_type` e `aggregate_id`. O `event_type` serve para registro e diagnóstico.

| `aggregate_type` | Eventos | Coleção atualizada |
|---|---|---|
| `CATEGORY` | `CategoryUpserted` | `categories` |
| `PRODUCT` | `ProductUpserted`, `ProductStockChanged` | `products` |
| `ORDER` | `OrderPlaced`, `OrderStatusChanged` | `orders` |

`ReprocessRequested` pode ser usado em qualquer um dos três tipos.

O worker **não aplica o conteúdo do evento**. Ele relê o estado atual no PostgreSQL e substitui o documento inteiro. Se o registro não existir mais, apaga o documento. Por isso, processar o mesmo evento outra vez é seguro. Eventos não devem disparar outros efeitos, como notificações, dentro deste worker.

Uma mudança de nome ou `slug` de categoria também incrementa a versão dos produtos dela e gera um evento para cada um.

### Leitura no PostgreSQL

Cada documento é carregado com **uma única instrução SQL**, para a versão e o conteúdo virem do mesmo momento. As mesmas consultas servem ao worker e à reconstrução.

```sql
-- load-category
SELECT id, slug, name, version
FROM categories
WHERE id = ANY($1::uuid[]);
```

```sql
-- load-product
SELECT p.id, p.title, p.thumbnail, p.price, p.discount_percentage, p.stock,
       p.details, p.is_active, p.created_at, p.version,
       c.id AS category_id, c.slug AS category_slug, c.name AS category_name
FROM products p
JOIN categories c ON c.id = p.category_id
WHERE p.id = ANY($1::uuid[]);
```

```sql
-- load-order
SELECT o.id, o.order_number, o.user_id, o.status, o.created_at,
       o.total_quantity, o.total, o.version,
       json_agg(json_build_object(
           'productId', i.product_id,
           'title',     i.title,
           'thumbnail', i.thumbnail,
           'price',     i.price::text,
           'quantity',  i.quantity
       ) ORDER BY i.title, i.product_id) AS items
FROM orders o
JOIN order_items i ON i.order_id = o.id
WHERE o.id = ANY($1::uuid[])
GROUP BY o.id;
```

O preço dos itens sai como texto para não passar por número de ponto flutuante antes de virar `Decimal128`.

### Gravação no MongoDB

```js
const isDuplicateId = (error) => error.code === 11000 && error.keyPattern?._id === 1;

async function saveView(collection, doc) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await collection.replaceOne(
        { _id: doc._id, version: { $lte: doc.version } },
        doc,
        { upsert: true },
      );
      return;
    } catch (error) {
      if (!isDuplicateId(error)) throw error;
    }
  }
  // Duas vezes duplicado: o MongoDB já tem uma versão mais nova.
}
```

| Situação | Resultado |
|---|---|
| Documento não existe | é criado |
| Versão gravada menor ou **igual** | o documento é substituído |
| Versão gravada maior | o upsert tenta inserir, recebe chave duplicada em `_id` e nada muda |

- **`$lte`** permite regravar a mesma versão, o que é necessário quando o formato ou um cálculo da view muda. Isso pressupõe que todos os processos de projeção rodam o mesmo código.
- **A segunda tentativa** cobre duas gravações simultâneas de um documento novo: o erro pode ocorrer mesmo quando a versão recebida é a mais nova. Como o filtro usa uma comparação de versão, não se deve contar com a repetição automática do servidor.
- **Só a chave duplicada em `_id` é esperada.** Duplicidade em outro índice, como `slug_unique`, é um erro real.

A exclusão usa `deleteOne({ _id })`. O desenho considera **um worker**. Com vários, uma gravação atrasada poderia recriar um documento recém-excluído; isso precisaria ser tratado antes.

### Ciclo do worker

1. Abrir uma transação (`READ COMMITTED`).
2. Tentar a trava compartilhada com a reconstrução. Se não conseguir, encerrar a transação e esperar. Ver `05-reprocessamento-mongodb.md`.
3. Selecionar um lote pendente.
4. Para cada evento, carregar o registro, gravar ou apagar a view e marcar o resultado.
5. Confirmar a transação e repetir.

```sql
-- worker-lock
SELECT pg_try_advisory_xact_lock_shared(727001) AS locked;
```

```sql
-- worker-batch
SELECT id, aggregate_type, aggregate_id
FROM outbox_events
WHERE processed_at IS NULL AND attempts < 10
ORDER BY id
LIMIT 50
FOR UPDATE SKIP LOCKED;
```

```sql
-- worker-success
UPDATE outbox_events SET processed_at = now(), last_error = NULL WHERE id = $1;
```

```sql
-- worker-failure
UPDATE outbox_events SET attempts = attempts + 1, last_error = $2 WHERE id = $1;
```

- O limite de 10 tentativas e o lote de 50 são valores propostos. Aguarde um intervalo após um ciclo com falha, para uma queda curta do MongoDB não esgotar as tentativas em sequência.
- Um erro do PostgreSQL aborta a transação do lote. Nesse caso, faça `ROLLBACK` e tente em um ciclo posterior. Eventos já aplicados no MongoDB serão processados de novo, o que é seguro.
- Um evento que atingiu o limite continua pendente e deve ser tratado conforme o documento de reprocessamento.
- A ordem por `id` não garante a ordem de confirmação das transações. A releitura do estado atual e a versão tornam isso aceitável.
- As views ficam **eventualmente consistentes**: uma mudança pode demorar a aparecer. O checkout sempre valida no PostgreSQL.
