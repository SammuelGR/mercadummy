-- Mercadummy: modelo de escrita (PostgreSQL, fonte da verdade)

CREATE TYPE user_role    AS ENUM ('admin', 'user');
CREATE TYPE order_status AS ENUM ('PROCESSING', 'DELIVERED');

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name     VARCHAR(150) NOT NULL,
    email         VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          user_role    NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));

CREATE TABLE categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug       VARCHAR(60) NOT NULL UNIQUE,
    name       VARCHAR(80) NOT NULL,
    version    INTEGER     NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Colunas: o que participa da transação, do relacionamento ou do controle da projeção.
-- details: atributos descritivos, com chaves em camelCase:
--   description, rating, brand, sku, weight, dimensions {width, height, depth},
--   warrantyInformation, shippingInformation, returnPolicy, minimumOrderQuantity,
--   tags[], images[], reviews[], meta {barcode, qrCode}
CREATE TABLE products (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id         INTEGER       UNIQUE,
    category_id         UUID          NOT NULL REFERENCES categories (id),
    title               VARCHAR(150)  NOT NULL,
    price               NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    discount_percentage NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (discount_percentage BETWEEN 0 AND 100),
    stock               INTEGER       NOT NULL CHECK (stock >= 0),
    thumbnail           TEXT          NOT NULL,
    details             JSONB         NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
    is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
    version             INTEGER       NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products (category_id);

-- order_number é o número exibido ("Pedido #1043") e começa em 1001
CREATE TABLE orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number     INTEGER GENERATED ALWAYS AS IDENTITY (START WITH 1001) UNIQUE,
    user_id          UUID          NOT NULL REFERENCES users (id),
    status           order_status  NOT NULL DEFAULT 'PROCESSING',
    total            NUMERIC(12,2) NOT NULL CHECK (total >= 0),
    discounted_total NUMERIC(12,2) NOT NULL CHECK (discounted_total >= 0),
    total_products   INTEGER       NOT NULL CHECK (total_products > 0),
    total_quantity   INTEGER       NOT NULL CHECK (total_quantity > 0),
    idempotency_key  UUID          NOT NULL,
    version          INTEGER       NOT NULL DEFAULT 1,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key)
);
CREATE INDEX orders_user_idx ON orders (user_id, created_at DESC);

-- title, thumbnail, price e discount_percentage: cópia do momento da compra
CREATE TABLE order_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID          NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id          UUID          NOT NULL REFERENCES products (id),
    title               VARCHAR(150)  NOT NULL,
    thumbnail           TEXT          NOT NULL,
    price               NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    discount_percentage NUMERIC(5,2)  NOT NULL DEFAULT 0,
    quantity            INTEGER       NOT NULL CHECK (quantity > 0),
    total               NUMERIC(12,2) NOT NULL,
    discounted_total    NUMERIC(12,2) NOT NULL,
    UNIQUE (order_id, product_id)
);

CREATE TABLE outbox_events (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aggregate_type    VARCHAR(30) NOT NULL CHECK (aggregate_type IN ('PRODUCT', 'CATEGORY', 'ORDER')),
    aggregate_id      UUID        NOT NULL,
    event_type        VARCHAR(50) NOT NULL,
    payload           JSONB       NOT NULL DEFAULT '{}',
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at      TIMESTAMPTZ,
    attempts          INTEGER     NOT NULL DEFAULT 0,
    last_error        TEXT
);
CREATE INDEX outbox_pending_idx ON outbox_events (id) WHERE processed_at IS NULL;
