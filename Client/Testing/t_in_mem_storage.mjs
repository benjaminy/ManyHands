/*
 * Top Matter
 */

import assert  from "../Source/Utilities/assert";
import A       from "../Source/Utilities/activities";
import SM      from "../Source/Storage/in_memory";
import * as SW from "../Source/Storage/wrappers";

const s = SM( "alice" );

s.upload( "sadf", { header_hooks:[]} );

console.log( "t_in_mem_storage reached EOF" );
