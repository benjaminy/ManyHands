## B+-trees as an index

B+ Trees seem to be a promising direction for our remote storage.

A few shapes and considerations still need to be explored and investigated in order to tune the database and make sure it can be as quick as it possibly can be, given our constraints.

It seems like many sensible InnoDB B+ Tree indices rarely reach anything above 3-4 levels (see chart at the bottom of [this article](https://blog.jcole.us/2013/01/10/btree-index-structures-in-innodb/)].
