+++
date = "2026-03-26"
title = "MongoDB: Basic CRUD, Projections, Operators"
tags = ["mongodb", "til", "database"]
+++

### Insert

```js
db.users.insertOne({ name: "Alice", age: 30, active: true })
db.users.insertMany([{ name: "Bob", age: 25 }, { name: "Carol", age: 35 }])
```

### Find

```js
db.users.find({ age: { $gte: 25, $lt: 35 } })
db.users.findOne({ name: "Alice" })
```

**Comparison operators:** `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`

**Boolean operators:**

```js
db.users.find({ $and: [{ age: { $gte: 25 } }, { active: true }] })
db.users.find({ $or:  [{ age: { $lt: 20 } }, { name: "Alice" }] })
db.users.find({ age: { $not: { $gt: 30 } } })
db.users.find({ $nor: [{ active: true }, { age: { $lt: 18 } }] })
```

**Projections** — `1` to include, `0` to exclude (can't mix, except `_id`):

```js
db.users.find({}, { name: 1, age: 1, _id: 0 })
```

**Sort:**

```js
db.users.find().sort({ age: 1 })   // ascending
db.users.find().sort({ age: -1 })  // descending
```

**Limit / Skip:**

```js
db.users.find().sort({ age: 1 }).skip(5).limit(10)
```

### Update

```js
db.users.updateOne({ name: "Alice" }, { $set: { age: 31 } })
db.users.updateMany({ active: false }, { $unset: { score: "" } })
```

**Field update operators:**

| Operator | Effect |
|---|---|
| `$set` | Set field value |
| `$unset` | Remove field |
| `$inc` | Increment by value (`$inc: { age: 1 }`) |
| `$mul` | Multiply field (`$mul: { score: 2 }`) |

**Array update operators:**

| Operator | Effect |
|---|---|
| `$push` | Append element to array |
| `$pop` | Remove first (`-1`) or last (`1`) element |
| `$pull` | Remove all elements matching a condition |
| `$pullAll` | Remove all matching values from a list |

```js
db.users.updateOne({ name: "Alice" }, { $push: { tags: "admin" } })
db.users.updateOne({ name: "Alice" }, { $pop:  { tags: 1 } })           // remove last
db.users.updateOne({ name: "Alice" }, { $pull: { tags: "admin" } })
db.users.updateOne({ name: "Alice" }, { $pullAll: { tags: ["a", "b"] } })
```

**Upsert** — create if not found:

```js
db.users.updateOne({ name: "Dave" }, { $set: { age: 40 } }, { upsert: true })
```

### Delete

```js
db.users.deleteOne({ name: "Bob" })
db.users.deleteMany({ active: false })
```
