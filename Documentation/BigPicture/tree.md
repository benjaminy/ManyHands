Storage Tree Stuff
=======================

UWS requires a relatively simple storage server to save all state to.

Data is stored as a tree of files.
(Maybe this is a lie and it's really a DAG.
That doesn't sound as good.)
The root has a globally known name/path/location.
All other files have randomly generated names; they should only ever be reached by following links from other tree nodes.
Links to non-root files should not be stored elsewhere; they are all transient.

## Nodes

In its stored form, each node has the following fields:

- plain data (map: key -> primitive value)
- links to children (map: key -> child link)
- a set of children (really, keys) whose links have blank timestamps

In its in-memory form, each node has the following fields in addition
to the ones above:

- memory cache information
- local storage cache information
- dirty children (set of keys)
- children to delete (set of links)
- the storage object
- maybe some storage options

Previously it seemed like having arrays of children as a primitive concept would be useful, but I haven't been able to think of a way in which that's actually better than leaving it up to client code to make up a naming scheme like "stuff-0", "stuff-1", etc.
It might be worthwhile to make a convenience library for arrays of children.

Each field has a name.
(This may be totally uninteresting, but FWIW the children fields and plain data fields are in different name spaces for now.)

When a node is downloaded it comes with all its plain data and links to its children.
(The links can be fairly complicated beasts with URLs, crypto keys, timestamps and whatnot.)
For good performance, it is up to client code to make nodes that are of a good size.
Nodes that are too big can cause undesireable latency.
Nodes that are too small will mean longer chains of seperate requests.
I have no idea currently where the boundaries are between too big, just right and too small.

Nodes are functional in the sense that "modifying" any of a node's fields will create a new copy of the node with the modification.
Any such changes will not be saved persistently unless and until that new copy is stitched into a new complete tree that is then synced.

For the time being we are using Transit from the clojure community to (de)serialize data, so plain data formats include whatever is supported by that library.

## Timestamps

Every parent-child link can (but may not!) have a client-provided timestamp; we call these _link timestamps_.
When a tree root is downloaded we take the server-provided timestamp to be the root's timestamp.
A node's _effective timestamp_ is the first link timestamp in the path from that node up to the root, or the root's timestamp if no such link timestamps exist.

When writing new nodes into a tree, all of the newly created nodes should have empty/blank link timestamps.
Any links from newly written nodes to old/unmodified subtrees with empty/blank timestamps should be reewritten to include that subtree's effective timestamp.

## Storage

Lazy automatic rehydration of the links??? Seems ok.
Dehydration needs to be explicit.

/* is there any reason for nodes to "know" their own location? */

