import process from './normalize_query';

process([':find', ['?e', '?x'], ':where', ['?e', ':eats', '?x']]);

    /*[
    findK, [ "?vtype", "?card", "?doc", "?uniq", "?idx", "?ftxt", "?isComp", "?noHist" ],
        inK, "$", "?ident",
        whereK, [ "?attr", DA.identK,       "?ident" ],
        [ "?attr", DA.valueTypeK,   "?vtype" ],
        [ "?attr", DA.cardinalityK, "?card" ],
        [ "?attr", DA.docK,         "?doc" ],
        [ "?attr", DA.uniqueK,      "?uniq" ],
        [ "?attr", DA.indexK,       "?idx" ],
        [ "?attr", DA.fulltextK,    "?ftxt" ],
        [ "?attr", DA.isComponentK, "?isComp" ],
        [ "?attr", DA.noHistoryK,   "?noHist" ] ] );
        */