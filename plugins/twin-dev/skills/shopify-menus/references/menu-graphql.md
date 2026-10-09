# Menu GraphQL reference

Admin GraphQL API. Scopes: `read_online_store_navigation` to read,
`write_online_store_navigation` to create, update or delete.

## List menus (with three levels of items)

```graphql
query Menus {
  menus(first: 50) {
    nodes {
      id
      handle
      title
      isDefault
      items { ...Item items { ...Item items { ...Item } } }
    }
  }
}

fragment Item on MenuItem {
  id
  title
  type
  url
  resourceId
  tags
}
```

## Create a menu

```graphql
mutation MenuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
  menuCreate(title: $title, handle: $handle, items: $items) {
    menu { id handle title }
    userErrors { field message code }
  }
}
```

Variables:

```json
{
  "title": "Main menu",
  "handle": "main-menu-2",
  "items": [
    { "title": "Home", "type": "FRONTPAGE", "url": "/" },
    {
      "title": "Shop",
      "type": "COLLECTION",
      "resourceId": "gid://shopify/Collection/123",
      "items": [
        { "title": "New in", "type": "COLLECTION", "resourceId": "gid://shopify/Collection/456" },
        { "title": "All products", "type": "CATALOG", "url": "/collections/all" }
      ]
    },
    { "title": "About", "type": "PAGE", "resourceId": "gid://shopify/Page/789" },
    { "title": "Instagram", "type": "HTTP", "url": "https://instagram.com/brand" }
  ]
}
```

## Update a menu

`items` is the **whole** tree. Anything you leave out is removed. Keep existing
items by sending their `id`; items without `id` are created.

```graphql
mutation MenuUpdate($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) {
  menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
    menu { id handle title }
    userErrors { field message code }
  }
}
```

Don't send `handle` for a default menu (`isDefault: true`, usually `main-menu` and
`footer`); its handle can't change.

## Delete a menu

```graphql
mutation MenuDelete($id: ID!) {
  menuDelete(id: $id) {
    deletedMenuId
    userErrors { field message code }
  }
}
```

Default menus can't be deleted.

## Item types

| Type | Needs | Links to |
|---|---|---|
| `FRONTPAGE` | — | Home page |
| `CATALOG` | — | All products (`/collections/all`) |
| `COLLECTIONS` | — | Collections list (`/collections`) |
| `COLLECTION` | `resourceId` Collection | A collection |
| `PRODUCT` | `resourceId` Product | A product |
| `PAGE` | `resourceId` Page | A page |
| `BLOG` | `resourceId` Blog | A blog |
| `ARTICLE` | `resourceId` Article | A blog post |
| `SHOP_POLICY` | `resourceId` ShopPolicy | A policy page |
| `METAOBJECT` | `resourceId` Metaobject | A metaobject page |
| `SEARCH` | — | Search page |
| `CUSTOMER_ACCOUNT_PAGE` | `resourceId` | A customer account page |
| `HTTP` | `url` | Any URL, internal path or external link |

`tags` (optional, `COLLECTION` items) filters the collection by product tags.

If Shopify rejects a type, check the enum on the store's API version:

```graphql
{ __type(name: "MenuItemType") { enumValues { name } } }
```

## Look up resource IDs

```graphql
query Resources {
  collections(first: 250) { nodes { id handle title } }
  pages(first: 250) { nodes { id handle title } }
  blogs(first: 50) { nodes { id handle title } }
  shop { shopPolicies { id type title url } }
}
```

For a few products or articles, query by handle instead of listing everything:

```graphql
query Product($handle: String!) {
  productByIdentifier(identifier: { handle: $handle }) { id handle title }
}
```

```graphql
query Articles($q: String!) {
  articles(first: 10, query: $q) { nodes { id handle title blog { handle } } }
}
```
