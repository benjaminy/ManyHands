## B+-trees as an index

B+ Trees seem to be a promising direction for our remote storage.

A few shapes and considerations still need to be explored and investigated in order to tune the database and make sure it can be as quick as it possibly can be, given our constraints.

It seems like many sensible InnoDB B+ Tree indices rarely reach anything above 3-4 levels (see chart at the bottom of [this article](https://blog.jcole.us/2013/01/10/btree-index-structures-in-innodb/)].

B+ trees can be manufactured to work really well for contents which are stored on disk. For example, if your disk is capable of reading/writing 4 KiB of data per read/write operation, you can manufacture a tree with a particular fanout such that each node in the tree has a maximum size of 4KiB, and can conveniently be read/written.

Having the database stored remotely means we have to center our fanout around slightly different constraints, in order to strike a balance between reading blocks of a reasonable size while also minimizing the number of sequential requests necessary to retrieve bits of information.

