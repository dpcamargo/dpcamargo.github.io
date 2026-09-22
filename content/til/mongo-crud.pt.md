+++
date = "2026-03-26"
title = "MongoDB: CRUD básico, projeções, operadores"
tags = ["mongodb", "til", "database"]
+++

### Inserir

```js
db.users.insertOne({ name: "Alice", age: 30, active: true })
db.users.insertMany([{ name: "Bob", age: 25 }, { name: "Carol", age: 35 }])
```

### Buscar

```js
db.users.find({ age: { $gte: 25, $lt: 35 } })
db.users.findOne({ name: "Alice" })
```

**Operadores de comparação:** `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`

**Operadores booleanos:**

```js
db.users.find({ $and: [{ age: { $gte: 25 } }, { active: true }] })
db.users.find({ $or:  [{ age: { $lt: 20 } }, { name: "Alice" }] })
db.users.find({ age: { $not: { $gt: 30 } } })
db.users.find({ $nor: [{ active: true }, { age: { $lt: 18 } }] })
```

**Projeções** — `1` para incluir, `0` para excluir (não dá para misturar, exceto o `_id`):

```js
db.users.find({}, { name: 1, age: 1, _id: 0 })
```

**Ordenação:**

```js
db.users.find().sort({ age: 1 })   // ascending
db.users.find().sort({ age: -1 })  // descending
```

**Limitar / Pular:**

```js
db.users.find().sort({ age: 1 }).skip(5).limit(10)
```

### Atualizar

```js
db.users.updateOne({ name: "Alice" }, { $set: { age: 31 } })
db.users.updateMany({ active: false }, { $unset: { score: "" } })
```

**Operadores de atualização de campos:**

| Operador | Efeito |
|---|---|
| `$set` | Define o valor do campo |
| `$unset` | Remove o campo |
| `$inc` | Incrementa em um valor (`$inc: { age: 1 }`) |
| `$mul` | Multiplica o campo (`$mul: { score: 2 }`) |

**Operadores de atualização de arrays:**

| Operador | Efeito |
|---|---|
| `$push` | Acrescenta um elemento ao array |
| `$pop` | Remove o primeiro (`-1`) ou o último (`1`) elemento |
| `$pull` | Remove todos os elementos que atendem a uma condição |
| `$pullAll` | Remove todos os valores que constam em uma lista |

```js
db.users.updateOne({ name: "Alice" }, { $push: { tags: "admin" } })
db.users.updateOne({ name: "Alice" }, { $pop:  { tags: 1 } })           // remove last
db.users.updateOne({ name: "Alice" }, { $pull: { tags: "admin" } })
db.users.updateOne({ name: "Alice" }, { $pullAll: { tags: ["a", "b"] } })
```

**Upsert** — cria se não encontrar:

```js
db.users.updateOne({ name: "Dave" }, { $set: { age: 40 } }, { upsert: true })
```

### Excluir

```js
db.users.deleteOne({ name: "Bob" })
db.users.deleteMany({ active: false })
```
