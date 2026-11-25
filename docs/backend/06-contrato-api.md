# Contrato da API

Rotas REST da API (NestJS, CQRS). A API ainda **não está implementada**; este é o contrato a ser seguido.

Os caminhos abaixo são da API e não se confundem com as rotas de tela do front.

## Rotas disponíveis

**Acesso:** `público` não exige sessão; `sessão` exige usuário autenticado, de qualquer papel; `admin` exige o papel `admin`.

| Método | Rota | Acesso | Tipo | Dados usados |
|---|---|---|---|---|
| `POST` | `/auth/register` | público | comando | PostgreSQL, Redis |
| `POST` | `/auth/login` | público | comando | PostgreSQL, Redis |
| `POST` | `/auth/logout` | sessão | comando | Redis |
| `GET` | `/auth/me` | sessão | consulta | Redis |
| `GET` | `/categories` | público | consulta | MongoDB |
| `GET` | `/products` | público | consulta | MongoDB |
| `GET` | `/products/:id` | público | consulta | MongoDB |
| `GET` | `/cart` | sessão | consulta | Redis, MongoDB |
| `POST` | `/cart/items` | sessão | comando | Redis, MongoDB |
| `PUT` | `/cart/items/:productId` | sessão | comando | Redis, MongoDB |
| `DELETE` | `/cart/items/:productId` | sessão | comando | Redis, MongoDB |
| `POST` | `/orders` | sessão | comando | Redis, PostgreSQL |
| `GET` | `/orders` | sessão | consulta | MongoDB |
| `GET` | `/admin/orders` | admin | consulta | MongoDB |
| `PATCH` | `/admin/orders/:id/status` | admin | comando | PostgreSQL |
| `POST` | `/admin/categories` | admin | comando | PostgreSQL |
| `POST` | `/admin/products` | admin | comando | PostgreSQL |

Nas rotas com acesso `sessão` ou `admin`, a sessão é sempre validada no Redis.

## Convenções

| Tema | Regra |
|---|---|
| Formato | JSON em UTF-8, `Content-Type: application/json`, campos em camelCase |
| Identificadores | UUID em texto |
| Dinheiro | número com até 2 casas decimais |
| Datas | texto ISO 8601 em UTC, por exemplo `2026-11-25T18:32:00.000Z` |
| Autenticação | cookie `sid`; o front usa `credentials: 'include'` |
| Campos não previstos | recusados com `400 VALIDATION_ERROR` |
| Id inválido no caminho | tratado como registro inexistente (`404`); em `DELETE` do carrinho, `400` |
| Usuário | identificado **somente pela sessão**; nenhuma rota aceita `userId` do cliente |

Os detalhes do cookie, do CORS e da verificação de `Origin` estão em `03-redis.md`.

**Consistência eventual:** as consultas ao MongoDB podem demorar a refletir um comando. Por isso, os comandos devolvem o necessário para o front confirmar o resultado sem depender da view.

## Erros

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "fields": [{ "field": "email", "message": "Invalid email" }]
}
```

`code` e `message` sempre existem. `message` é um texto em inglês; o front decide o que fazer pelo `code`.

| Campo extra | Quando aparece |
|---|---|
| `fields[]` (`field`, `message`) | `VALIDATION_ERROR` |
| `items[]` (`productId`, `requested`, `available`) | `INSUFFICIENT_STOCK` e `PRODUCT_UNAVAILABLE` |
| `existingId` | `CATEGORY_ALREADY_EXISTS` e `PRODUCT_ALREADY_EXISTS` |

| HTTP | `code` | Significado |
|---|---|---|
| 400 | `VALIDATION_ERROR` | dados ou JSON inválidos |
| 401 | `UNAUTHENTICATED` | sem sessão válida |
| 401 | `INVALID_CREDENTIALS` | e-mail ou senha incorretos |
| 403 | `FORBIDDEN` | o papel não permite a operação |
| 403 | `INVALID_ORIGIN` | origem não permitida em uma escrita |
| 404 | `PRODUCT_NOT_FOUND` | produto inexistente ou inativo |
| 404 | `CART_ITEM_NOT_FOUND` | item não está no carrinho |
| 404 | `ORDER_NOT_FOUND` | pedido inexistente |
| 409 | `EMAIL_ALREADY_IN_USE` | e-mail já cadastrado |
| 409 | `INSUFFICIENT_STOCK` | quantidade maior que o estoque |
| 409 | `PRODUCT_UNAVAILABLE` | produto do carrinho indisponível no checkout |
| 409 | `CART_EMPTY` | checkout com carrinho vazio |
| 409 | `ORDER_STATUS_CONFLICT` | o pedido não está em `PROCESSING` |
| 409 | `CATEGORY_ALREADY_EXISTS` | `slug` já cadastrado |
| 409 | `PRODUCT_ALREADY_EXISTS` | `externalId` já cadastrado |
| 409 | `SKU_ALREADY_IN_USE` | SKU usado por outro produto |
| 422 | `CATEGORY_NOT_FOUND` | `categoryId` não existe |
| 500 | `INTERNAL_ERROR` | erro inesperado, sem detalhes internos |
| 503 | `SERVICE_UNAVAILABLE` | PostgreSQL, MongoDB ou Redis necessário está indisponível |

Os erros gerais (`400`, `401 UNAUTHENTICATED`, `403`, `500` e `503`) valem para as rotas em que se aplicam e não são repetidos abaixo.

## Autenticação

### `POST /auth/register`

```json
{ "fullName": "Maria Souza", "email": "maria@example.com", "password": "uma-senha-segura" }
```

| Campo | Regra |
|---|---|
| `fullName` | obrigatório, 1 a 150 caracteres, sem espaços nas pontas |
| `email` | obrigatório, formato válido, até 254 caracteres; gravado em minúsculas |
| `password` | obrigatória, 8 a 128 caracteres |

A confirmação da senha é validada no front e **não é enviada**. O papel é sempre `user`.

**`201`**, com o cookie `sid`:

```json
{ "id": "7f1c2a9e-4b3d-4c8a-9f21-6d5e8b0a1c34", "fullName": "Maria Souza", "role": "user" }
```

**Erros:** `409 EMAIL_ALREADY_IN_USE`. Se o Redis falhar depois de a conta ser criada, a resposta é `503`; o usuário deve fazer login.

### `POST /auth/login`

```json
{ "email": "maria@example.com", "password": "uma-senha-segura" }
```

**`200`**, com um novo cookie `sid` e o mesmo corpo do cadastro. A comparação do e-mail ignora maiúsculas.

**Erros:** `401 INVALID_CREDENTIALS`, com a mesma resposta para e-mail inexistente e senha incorreta.

### `POST /auth/logout`

Sem corpo. **`204`**: encerra a sessão e expira o cookie. O carrinho é mantido.

### `GET /auth/me`

**`200`**, com o mesmo corpo do cadastro. Um visitante recebe `401 UNAUTHENTICATED`.

## Catálogo

### `GET /categories`

**`200`**, em ordem de nome:

```json
{ "items": [{ "id": "4c1f8b2e-9a07-4d5c-b3e6-0f2a7c9d1b48", "slug": "beauty", "name": "Beauty" }] }
```

### `GET /products`

| Parâmetro | Tipo | Padrão | Regra |
|---|---|---|---|
| `search` | texto | | busca no nome, sem diferenciar acentos e maiúsculas; até 100 caracteres |
| `category` | slug | | uma categoria; um slug desconhecido gera lista vazia |
| `inStock` | `true` ou `false` | `false` | `true` mostra somente estoque maior que zero |
| `cursor` | texto | | `nextCursor` da resposta anterior |
| `limit` | inteiro | 12 | 1 a 100 |

**`200`**:

```json
{
  "items": [
    {
      "id": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61",
      "title": "Essence Mascara Lash Princess",
      "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
      "category": { "id": "4c1f8b2e-9a07-4d5c-b3e6-0f2a7c9d1b48", "slug": "beauty", "name": "Beauty" },
      "price": 9.99,
      "discountPercentage": 10,
      "rating": 2.56,
      "stock": 99,
      "availabilityStatus": "In Stock"
    }
  ],
  "nextCursor": null
}
```

- `price` é o preço cheio. `discountPercentage` é o inteiro exibido no selo; com `0`, o front oculta o selo.
- `rating` pode não existir.
- `availabilityStatus`: `In Stock`, `Low Stock` ou `Out of Stock`.
- Ao mudar busca ou filtros, o front descarta o cursor.

**Erros:** cursor ou parâmetro inválido gera `400 VALIDATION_ERROR`.

### `GET /products/:id`

**`200`**: os campos de um item da lista e mais:

```json
{
  "description": "The Essence Mascara Lash Princess is a popular mascara...",
  "images": ["https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/1.webp"],
  "specifications": [{ "label": "Brand", "value": "Essence" }]
}
```

`description` pode ser vazia, assim como as listas. Sem imagens, o front pode usar `thumbnail`.

**Erros:** `404 PRODUCT_NOT_FOUND`.

## Carrinho

As quatro rotas respondem com o **carrinho completo**:

```json
{
  "items": [
    {
      "productId": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61",
      "title": "Essence Mascara Lash Princess",
      "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
      "price": 9.99,
      "quantity": 2,
      "stock": 99
    },
    {
      "productId": "e8d3c7b1-6a24-4f0d-b95a-1c7e4f2a8d90",
      "quantity": 1,
      "issue": "PRODUCT_UNAVAILABLE"
    }
  ],
  "totalQuantity": 3,
  "total": 19.98
}
```

- `issue` só aparece quando há problema: `PRODUCT_UNAVAILABLE` ou `INSUFFICIENT_STOCK`. A indisponibilidade tem prioridade.
- Um item sem produto encontrado traz apenas `productId`, `quantity` e `issue`. Um produto inativo traz os demais campos.
- `total` é a preço cheio e não soma itens indisponíveis.
- Com qualquer `issue`, o front impede o checkout.
- O contador do cabeçalho usa `totalQuantity`.
- Um carrinho vazio é `{ "items": [], "totalQuantity": 0, "total": 0 }`.

### `GET /cart`

Sem parâmetros. **`200`** com o carrinho.

### `POST /cart/items`

Soma a quantidade à que já existe.

```json
{ "productId": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61", "quantity": 2 }
```

`quantity` é um inteiro a partir de 1. **`200`** com o carrinho.

**Erros:** `404 PRODUCT_NOT_FOUND` e `409 INSUFFICIENT_STOCK`. Nesse erro, `requested` é o total que ficaria no carrinho.

Esta rota **não é idempotente**. Após uma falha de rede ou um `503`, consulte o carrinho antes de repetir, pois a soma pode já ter sido feita.

### `PUT /cart/items/:productId`

Substitui a quantidade de um item existente.

```json
{ "quantity": 3 }
```

`quantity` é um inteiro a partir de 1. **`200`** com o carrinho.

**Erros:** `404 PRODUCT_NOT_FOUND`, `404 CART_ITEM_NOT_FOUND` e `409 INSUFFICIENT_STOCK`.

### `DELETE /cart/items/:productId`

Sem corpo. **`200`** com o carrinho. Remover um item ausente não é erro. A remoção funciona mesmo que o produto esteja indisponível.

## Pedidos

### `POST /orders`

Finaliza a compra do carrinho. A API **não recebe itens nem preços** do front.

```json
{ "idempotencyKey": "3a9c5e71-8b24-4d0f-a6c3-1e7f9b2d5c48" }
```

- O front gera o UUID ao abrir o checkout e **reutiliza o mesmo valor** ao repetir uma tentativa.
- Depois de um pedido criado, uma nova compra precisa de outra chave.
- Estoque e preços são validados no PostgreSQL.

**`201`** quando o pedido é criado, ou **`200`** quando a chave já tinha um pedido. O corpo é igual:

```json
{ "orderId": "9d3e7a15-2c84-4b6f-a0d9-5e1f8c4b7a23", "orderNumber": 1001 }
```

A tela de confirmação usa esta resposta, pois o pedido pode demorar a aparecer no histórico.

**Erros:** `409 CART_EMPTY`, `409 INSUFFICIENT_STOCK` e `409 PRODUCT_UNAVAILABLE`.

- `items` lista todos os itens com problema.
- Se houver os dois tipos de problema, o `code` é `PRODUCT_UNAVAILABLE`.
- Para um produto indisponível, `available` é `0`.
- Em caso de erro, nenhum pedido é criado e o estoque não muda.

O fluxo completo e a limpeza do carrinho estão em `03-redis.md`. Há um ponto de atenção sobre compra duplicada em duas abas.

### `GET /orders`

Pedidos do usuário da sessão, do mais recente para o mais antigo. Não há paginação.

**`200`**:

```json
{
  "items": [
    {
      "id": "9d3e7a15-2c84-4b6f-a0d9-5e1f8c4b7a23",
      "orderNumber": 1001,
      "status": "PROCESSING",
      "createdAt": "2026-11-25T18:32:00.000Z",
      "totalQuantity": 2,
      "total": 19.98,
      "items": [
        {
          "productId": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61",
          "title": "Essence Mascara Lash Princess",
          "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
          "price": 9.99,
          "quantity": 2
        }
      ]
    }
  ]
}
```

Título, miniatura e preço são os da data da compra.

## Administração de pedidos

O `screens.md` não define uma tela para estas rotas.

### `GET /admin/orders`

Parâmetro opcional `status`: `PROCESSING` ou `DELIVERED`. Não há paginação.

**`200`**: o formato de `GET /orders`, com os pedidos de todos os usuários e o campo `userId` em cada pedido. A view não contém o nome do usuário.

### `PATCH /admin/orders/:id/status`

```json
{ "status": "DELIVERED" }
```

`DELIVERED` é o único valor aceito.

**`200`**:

```json
{ "id": "9d3e7a15-2c84-4b6f-a0d9-5e1f8c4b7a23", "orderNumber": 1001, "status": "DELIVERED" }
```

**Erros:** `404 ORDER_NOT_FOUND` e `409 ORDER_STATUS_CONFLICT`.

## Cadastro de catálogo (migração)

Usadas pelo script de migração. Não formam uma gestão completa de produtos: não há rotas para editar ou excluir.

O script faz `POST /auth/login` com uma conta `admin` e envia o cookie nas chamadas. Não existe rota para criar um `admin`.

### `POST /admin/categories`

```json
{ "slug": "beauty", "name": "Beauty" }
```

| Campo | Regra |
|---|---|
| `slug` | obrigatório, 1 a 60 caracteres; letras minúsculas, números e hífens entre eles |
| `name` | obrigatório, 1 a 80 caracteres |

**`201`**:

```json
{ "id": "4c1f8b2e-9a07-4d5c-b3e6-0f2a7c9d1b48", "slug": "beauty", "name": "Beauty" }
```

**Erros:** `409 CATEGORY_ALREADY_EXISTS`, com `existingId`. Nada é alterado, e o script usa esse id.

### `POST /admin/products`

```json
{
  "externalId": 1,
  "categoryId": "4c1f8b2e-9a07-4d5c-b3e6-0f2a7c9d1b48",
  "title": "Essence Mascara Lash Princess",
  "price": 9.99,
  "discountPercentage": 10.48,
  "stock": 99,
  "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
  "details": { "brand": "Essence", "rating": 2.56 }
}
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `externalId` | não | inteiro positivo; o script sempre envia |
| `categoryId` | sim | UUID de uma categoria existente |
| `title` | sim | 1 a 150 caracteres |
| `price` | sim | de 0 a 99999999.99, até 2 casas |
| `discountPercentage` | sim | 0 a 100, até 2 casas |
| `stock` | sim | inteiro a partir de 0 |
| `thumbnail` | sim | URL `http` ou `https` |
| `details` | sim | objeto; pode ser vazio |

Chaves aceitas em `details`, todas opcionais:

| Chave | Regra |
|---|---|
| `description`, `brand`, `sku`, `warrantyInformation`, `shippingInformation`, `returnPolicy` | texto não vazio |
| `rating` | número de 0 a 5 |
| `weight` | número a partir de 0 |
| `dimensions` | `width`, `height` e `depth`, números a partir de 0 |
| `minimumOrderQuantity` | inteiro a partir de 1 |
| `tags` | lista de textos |
| `images` | lista de URLs `http` ou `https` |
| `reviews` | lista de `rating` (inteiro de 1 a 5), `comment`, `date` (ISO 8601), `reviewerName` e `reviewerEmail` |
| `meta` | `barcode` (texto) e `qrCode` (URL) |

A API não aceita `id`, `createdAt`, `updatedAt`, `isActive` nem `version`. O produto é criado ativo.

**`201`**:

```json
{ "id": "b2a6e0d4-1f57-4a93-8c0e-3d9b7a5f2e61", "externalId": 1 }
```

`externalId` é `null` quando não é enviado.

**Erros, nesta ordem de verificação:**

1. `409 PRODUCT_ALREADY_EXISTS`, com `existingId`: o `externalId` já existe. Nada é alterado.
2. `422 CATEGORY_NOT_FOUND`.
3. `409 SKU_ALREADY_IN_USE`.

A ordem importa: em uma nova migração, um produto já importado deve ser informado como existente, e não como SKU repetido. Uma violação concorrente do `external_id` retorna o mesmo `PRODUCT_ALREADY_EXISTS`.

A unicidade do SKU é conferida pela aplicação, sem constraint no banco. Duas criações simultâneas podem passar por essa conferência; o script envia um produto por vez.

As duas rotas gravam o registro e o evento da outbox na **mesma transação**. O item aparece no catálogo após a projeção.

## Telas e rotas

| Tela ou componente | Rotas da API |
|---|---|
| Cabeçalho | `GET /auth/me`, `GET /cart` (contador), `POST /auth/logout` |
| `/` | `GET /categories`, `GET /products` |
| `/products/$id` | `GET /products/:id`, `POST /cart/items` |
| `/login` | `POST /auth/login` |
| `/register` | `POST /auth/register` |
| `/cart` | `GET /cart`, `PUT` e `DELETE /cart/items/:productId` |
| `/checkout` | `GET /cart`, `POST /orders` |
| `/orders` | `GET /orders` |

Para um visitante, `GET /auth/me` responde `401`, e o front não consulta o carrinho.

## Fora deste contrato

Filtro por preço, edição de perfil, edição e remoção de produtos, alteração de pedidos pelo comprador e recuperação de senha.
