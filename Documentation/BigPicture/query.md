[find-spec with-clause? inputs? where-clauses?]

The query system is capable of handling queries which contain as many where clauses as you care to provide, joined (implicitly) with `AND`.

In clojure, a simple query is expressed as such:

```clojure
[:find ?e
 :where [?e :age 42]]
```

An equivalent expression for us is as follows:

```javascript
const query = [k(":find"), "?e",
 k(":where"), ["?e", k(":age"), 42]];
```

`k(...)` refers to a transit keyword; i.e.

```javascript
import T from "transit-js";
const k = T.keyword;

const where_key = key(":where");
```

A database is set up as such:

```javascript
import * as DB from "./Source/Database/simple_txn_chain.mjs";
import SM from "./Source/Storage/in_memory.mjs";
import * as Q from "./Source/Database/query.mjs";

const in_mem_storage = SM();
const raw_storage = await (await tree_adaptor_wrapper(in_mem_storage))();
let db = DB.newDB(raw_storage);
```

We currently support a small subset of what datomic offers. Here is a brief overview of supported/unsupported features.

## Supported

**Joining/Chaining**

```javascript
const query = Q.parseQuery([k(":find"), "?a", "?b", "?c",
 k(":where"), 
    ["?a", k(":likes"), "?b"],
    ["?b", k(":likes"), "?c"]
]);

await Q.runQuery(db, query);

// [[a1, b1, c1], [a2, b2, c2], ...]
```

**In-parameters**

```javascript
const query = Q.parseQuery([k(":find"), "?a",
 k(":in"), "$", "?age",
 k(":where"), ["?a", k(":age"), "?age"]]);
 
await Q.runQuery(db, query, 42);

// [[123], [234], [345]]
```

*NOTE: multiple DB inputs are not supported yet.*
