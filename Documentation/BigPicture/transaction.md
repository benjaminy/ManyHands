Short version: Adapting Datomic to run distributed in the browser.
Mostly just copying Datomic.

Transaction statements are arrays of objects with one of the following shapes:
- [ :db/add, e, a, v ]
- { a:v, a:v, ... } ( optionally, one of the attributes can be :db/id)
- [ :db/retract, e, a, v ]
- [ fn-name (keyword), p1, p2, p3, ... ]





var example = [ DB.find, '?e', '?x',
                DB.where, [ '?e', ':age', '42' ], [ '?e', ':likes', '?x' ] ]

