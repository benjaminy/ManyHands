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





1, 4, 18, 23, 29, 36, 39

M. Ahamad, J. Burns, P. Hutto, and G. Neiger. Causal memory. In WDAG, pages 9–30, 1991

N. Belaramani, M. Dahlin, L. Gao, A. Nayate, A. Venkataramani, P. Yalagandula, and J. Zheng. PRACTI replication. In NSDI, 2006

R. Golding. A weak-consistency architecture for distributed information services. Computing Systems, 5(4):379–405, 1992.

R. Ladin, B. Liskov, L. Shrira, and S. Ghemawat. Providing high availability using lazy replication. ACM TOCS, 10(4):360–391, 1992

W. Lloyd, M. Freedman, M. Kaminsky, and D. Andersen. Don’t settle for eventual: Stronger consistency for wide-area storage. NSDI 2011 Poster Session, Mar. 2011. http://www.cs.princeton.edu/ ̃wlloyd/papers/widekv-poster-nsdi11.pdf

K. Petersen, M. J. Spreitzer, D. B. Terry, M. M. Theimer, and A. J. Demers. Flexible Update Propagation for Weakly Consistent Replication. In SOSP, 1997

M. Satyanarayanan, J. Kistler, P. Kumar, M. Okasaki, E. Siegel, and D. Steere. Coda: A highly available file system for distributed workstation environments. IEEE Transactions on Computers, 39(4):447–459, Apr. 1990

