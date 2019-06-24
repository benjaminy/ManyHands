Short version: Adapting Datomic to run distributed in the browser.
Mostly just copying Datomic.

Transaction statements are arrays of objects with one of the following shapes:
- [ :db/add, e, a, v ]
- { a:v, a:v, ... } ( optionally, one of the attributes can be :db/id)
- [ :db/retract, e, a, v ]
- [ fn-name (keyword), p1, p2, p3, ... ]


The transaction system is currently quite rudimentary, only supporting the addition of datoms to the schema. Revoking is currently not supported.

A database is set up as such:

```javascript
import * as DB from "./Source/Database/simple_txn_chain.mjs";
import SM from "./Source/Storage/in_memory.mjs";
import * as Q from "./Source/Database/query.mjs";

const in_mem_storage = SM();
const raw_storage = await (await tree_adaptor_wrapper(in_mem_storage))();
let db = DB.newDB(raw_storage);
```

Attributes from datomic have builtin ids, which are specified statically in this codebase. These are the attributes/values which start with `:db`.

All other attributes must be defined yourself in your schema. This may be done as such:

```javascript
import * as A from "./Source/Database/attribute.mjs";

const like_insert = DT.insertAttribute(
        A.makeAttribute(
            k(":likes"), // key-- the name of this attribute
            undefined, // id. leave this undefined
            A.vtypeRef, // the type that this attriubute accepts as a value. See attribute.js:20 for options
            A.cardinalityMany, // the cardinality of this attribute
            "Contains references to other entities this entity likes." // documentation for this attribute
            // optional: if this value is unique
            // optional: if this attribute should have a fulltext index
            // optional: if this attribute is a component attribute
            // optional: if history should be purged, for space reasons
        )
    );

db = await db.commitTxn(db, like_insert); // like_insert is a list of statements.
```

To add data into your schema, the format of a transaction follows:

```javascript
const statement = [DT.addK, "bob", k(":name"), "Bobethy"];

db = await db.commitTxn(db, [statement]);
```

Note that I used the name "bob" in this example-- that name is thrown out by our transaction systemn, and replaced with a number. Thus, a query on "bob" will not return any useful result.

However, the trasnaction system can recognize where names were used in multiple places, and act accordingly:

```javascript
const statements = [
    [DT.addK, "bob", k(":name"), "Bobethy"],
    [DT.addK, "mary", k(":name"), "Marticia"],
    [DT.addK, "mary", k(":likes"), "bob"]
];

// this operates under the assumption :name is defined as a string attribute, and :likes is a reference attribute.
```

Neither `bob` nor `mary` are saved, but the relationship is consistent-- a query (in clojure, for clarity):

```clojure
:find ?bname ?mname
:where [
    [?b :name ?bname],
    [?m :name ?mname],
    [?m :likes ?b]
]
```

This query returns `[[Bobethy, Marticia]]`.
