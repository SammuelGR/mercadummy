# Extração de dados do DummyJSON

Serão extraídos **somente categorias e produtos**. Usuários, pedidos, carrinhos e demais recursos ficam fora; os dados de usuários e pedidos serão criados depois.

A estrutura abaixo foi conferida nos arquivos e no código do [repositório oficial](https://github.com/Ovi/DummyJSON), não em chamadas à API publicada. Nessa cópia há 24 categorias e 194 produtos.

A migração será feita por um **script externo**, criado depois que a API estiver pronta. O script lê o DummyJSON e envia os dados à aplicação, sem escrever diretamente no banco.

## Fontes

| Ordem | Requisição | Retorno | Destino |
|---|---|---|---|
| 1 | `GET https://dummyjson.com/products/categories` | lista de categorias | `categories` |
| 2 | `GET https://dummyjson.com/products?limit=0` | objeto `{ products, total, skip, limit }` com todos os produtos | `products` |

Sem `limit=0`, a API devolve apenas 30 produtos. Confira se a quantidade em `products` é igual a `total`. Os campos `total`, `skip` e `limit` não são gravados.

## Categorias → `categories`

| Parâmetro | Destino | Tratamento |
|---|---|---|
| `slug` | `categories.slug` | cópia direta |
| `name` | `categories.name` | cópia direta, ex.: `Mens Shirts` |
| `url` | não gravado | aponta para a API do DummyJSON |
| (não existe) | `categories.id` | UUID v4 gerado pelo sistema |

## Produtos → colunas de `products`

| Parâmetro | Coluna | Tipo | Tratamento |
|---|---|---|---|
| `id` | `external_id` | `integer` | guarda o id de origem |
| `category` | `category_id` | `uuid` | traz o slug; usar o UUID da categoria com esse `slug` |
| `title` | `title` | `varchar(150)` | cópia direta |
| `price` | `price` | `numeric(10,2)` | cópia direta, preço sem desconto aplicado |
| `discountPercentage` | `discount_percentage` | `numeric(5,2)` | cópia exata, sem arredondar para inteiro |
| `stock` | `stock` | `integer` | cópia direta |
| `thumbnail` | `thumbnail` | `text` | grava a URL; a imagem não é baixada |

## Produtos → `products.details`

As chaves mantêm o mesmo nome e a mesma estrutura.

| Parâmetro | Caminho em `details` | Formato | Observação |
|---|---|---|---|
| `description` | `description` | texto | |
| `rating` | `rating` | número | não recalcular pelas avaliações |
| `brand` | `brand` | texto | ausente em 92 produtos; omitir a chave, sem gravar `null` |
| `sku` | `sku` | texto | validar que não se repete |
| `weight` | `weight` | número | a unidade não é informada |
| `dimensions.width` | `dimensions.width` | número | a unidade não é informada |
| `dimensions.height` | `dimensions.height` | número | |
| `dimensions.depth` | `dimensions.depth` | número | |
| `warrantyInformation` | `warrantyInformation` | texto | |
| `shippingInformation` | `shippingInformation` | texto | |
| `returnPolicy` | `returnPolicy` | texto | |
| `minimumOrderQuantity` | `minimumOrderQuantity` | inteiro | apenas guardado, sem regra de compra |
| `tags[]` | `tags` | lista de textos | |
| `images[]` | `images` | lista de URLs | manter a ordem; de 1 a 6 por produto |
| `reviews[].rating` | `reviews[].rating` | inteiro | |
| `reviews[].comment` | `reviews[].comment` | texto | |
| `reviews[].date` | `reviews[].date` | texto ISO 8601 | |
| `reviews[].reviewerName` | `reviews[].reviewerName` | texto | |
| `reviews[].reviewerEmail` | `reviews[].reviewerEmail` | texto | dado fictício; não vincula a `users` |
| `meta.barcode` | `meta.barcode` | texto | manter como texto |
| `meta.qrCode` | `meta.qrCode` | texto | URL |

## Parâmetros não gravados

| Parâmetro | Motivo |
|---|---|
| `meta.createdAt`, `meta.updatedAt` | as datas são as da própria aplicação |
| `availabilityStatus` | ficaria desatualizado após as vendas; é calculado a partir de `stock` |

## Colunas preenchidas pelo sistema

Em `products`:

| Coluna | Valor na criação |
|---|---|
| `id` | UUID v4 |
| `created_at`, `updated_at` | momento da criação na aplicação |
| `is_active` | `true` |
| `version` | `1` |

Em `categories`, `id`, `updated_at` e `version` seguem as mesmas regras.

## Exemplo de transformação (produto 1, abreviado)

Entrada:

```json
{
  "id": 1,
  "title": "Essence Mascara Lash Princess",
  "category": "beauty",
  "price": 9.99,
  "discountPercentage": 10.48,
  "stock": 99,
  "rating": 2.56,
  "brand": "Essence",
  "availabilityStatus": "In Stock",
  "meta": {
    "barcode": "5784719087687",
    "qrCode": "https://cdn.dummyjson.com/public/qr-code.png"
  },
  "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp"
}
```

Colunas:

| Coluna | Valor |
|---|---|
| `external_id` | `1` |
| `category_id` | UUID da categoria com `slug = 'beauty'` |
| `title` | `Essence Mascara Lash Princess` |
| `price` | `9.99` |
| `discount_percentage` | `10.48` |
| `stock` | `99` |
| `thumbnail` | URL da entrada |

`details`:

```json
{
  "rating": 2.56,
  "brand": "Essence",
  "meta": {
    "barcode": "5784719087687",
    "qrCode": "https://cdn.dummyjson.com/public/qr-code.png"
  }
}
```

## Fluxo da migração

1. O script busca as duas fontes e valida os dados antes de enviar qualquer coisa.
2. Faz login como `admin`, envia as categorias à API e guarda o UUID de cada `slug`.
3. Transforma cada produto e o envia à API com o UUID da categoria.
4. Ao final, informa quantos registros foram criados, ignorados e recusados.

### Validações no script

- `id`, `title`, `category`, `price`, `stock` e `thumbnail` presentes.
- Toda `category` de produto existe na lista de categorias.
- `price` e `stock` não negativos; `discountPercentage` entre 0 e 100. Se `discountPercentage` vier ausente, interromper a migração em vez de assumir 0.
- `id` e `sku` sem repetição.

## O que a API precisa suportar

Os endpoints, o formato das requisições e os erros estão em `06-contrato-api.md`.

- Criar categoria com `slug` e `name`, e devolver o UUID, inclusive quando o `slug` já existe.
- Criar produto recebendo o id de origem (`externalId`, gravado em `external_id`) e `details`.
- Restringir essas operações a um `admin`.
- Gerar ids e datas na aplicação, sem recebê-los do script.
- Gravar o evento `CategoryUpserted` ou `ProductUpserted` na mesma transação do registro, para o MongoDB ser atualizado.

### Executar a migração novamente

Categoria com `slug` já existente e produto com `external_id` já existente **não são criados nem alterados**. A API deve informar que o registro já existe, para o script contá-lo como ignorado e seguir. Assim, o estoque já vendido não volta ao valor original.

Cada registro é gravado separadamente. Se a execução parar no meio, o que foi criado permanece, e uma nova execução cria o restante.
