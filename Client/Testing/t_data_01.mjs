/* Top Matter */

import { assert }  from "../Source/Utilities/assert";
import { keyword } from "../Source/Utilities/keyword";
import * as DA from "../Source/Database/attribute";

const a01 = DA.makeAttribute(
    ":user/key", DA.vtypeString, DA.cardinalityMany,
    "docsdocsdocs", DA.uniqueValue, true, false, true, false );

console.log( a01 );

console.log( "t_data_01.mjs tests passed." );
