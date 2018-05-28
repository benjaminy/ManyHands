w/* Top Matter */

/* File comment */

import assert from "../Utilities/assert.mjs";
import A      from "../Utilities/act-thread";
import * as K from "../Utilities/keyword.mjs";

export const KIND_PUBLIC  = Symbol( "KIND_PUBLIC" );
export const KIND_PRIVATE = Symbol( "KIND_PRIVATE" );
export const KIND_TEAM    = Symbol( "KIND_TEAM" );

export const kinds = new Set( [ KIND_PUBLIC, KIND_PRIVATE, KIND_TEAM ] );

console.log( "Database/common loaded." );
