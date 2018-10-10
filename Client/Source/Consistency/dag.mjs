/* Top Matter */

import assert  from "assert";
import T from "transit-js";
// import * as UM from "../Utilities/misc";
// import * as L  from "../Utilities/logging";
// import * as K  from "../Utilities/keyword";
// import * as S  from "../Utilities/set";
// import * as DA from "./attribute";

var leaves = = new Set();

export async function receiveEdit( team, edit )
{
    const edit_id = [ edit.author, edit.serial_num ];
    if( team.leaves.has( edit_id ) )
    {
        throw new Error( "" );
    }
}

