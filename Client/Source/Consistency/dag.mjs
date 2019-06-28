/* Top Matter */

import assert  from "assert";
import T from "transit-js";
import * as UT from "../Utilities/transit.mjs";
// import * as UM from "../Utilities/misc";
// import * as L  from "../Utilities/logging";
// import * as K  from "../Utilities/keyword";
// import * as S  from "../Utilities/set";
// import * as DA from "./attribute";

// var leaves = = new Set();

const author_key       = T.keyword( "author" );
const serial_num_key   = T.keyword( "serial number" );
const depth_key        = T.keyword( "depth" );
const predecessors_key = T.keyword( "predecessors" );

// export async function receiveEdit( me, team, edit )
// {
//     const now = team.now; /* author -> vector TS */
//     const my_ts = now.get( me );
//     const most_recent_from_author = my_ts.summary.get( edit.author );
//     if( edit.serial_num <= most_recent_from_author )
//     {
//         throw new Error( "Weird Duplicate" );
//     }
//     else if( edit.serial_num > most_recent_from_author + 1 )
//     {
//         throw new UM.UnimplementedError( "Missing edits" );
//     }
//     else
//     {
//         assert( edit.serial_num === most_recent_from_author + 1 );
//         var have_all = true;
//         for( pred in edit.preds )
//         {
//             if( pred.serial_num > my_ts.summary.get( pred.author ) )
//             {
//                 have_all = false;
//             }
//         }
//         if( !have_all )
//         {
//             throw new UM.UnimplementedError( "Missing edits" );
//         }
//         var edit_preds_cover = true;
//         for( pred in team.most_recent )
//         {
//             if( !( pred in edit.preds ) )
//             {
//                 edit_preds_cover = false;
//             }
//         }
//         if( edit_preds_cover )
//         {
//             // Nice case where new edit is unambiguously the most recent
//             team.most_recent.clear();
//             team.most_recent = edit.preds.clone();
//             team.edit_total_order.push( edit );
//         }

//         team.now = meet( team.now, edit.now );
//         {
//         }
//     }
//     const edit_id = [ edit.author,  ];
//     if( team.leaves.has( edit_id ) )
//     {
//     }
// }

export function node( author, serial_number, depth, predecessors )
{
    const n = T.map();
    n.set( author_key, author );
    n.set( serial_num_key, serial_number );
    n.set( depth_key, depth );
    const preds = T.set();
    for( const p of predecessors )
    {
        preds.add( p );
    }
    n.set( predecessors_key, preds );
    return n;
}

function auth( n )
{
    assert( n.has( author_key ) );
    return n.get( author_key );
}

function serNum( n )
{
    assert( n.has( serial_number_key ) );
    return n.get( serial_number_key );
}

function depth( n )
{
    assert( n.has( depth_key ) );
    return n.get( depth_key );
}

function preds( n )
{
    assert( n.has( predecessors_key ) );
    return n.get( predecessors_key );
}

export function mergeMatrixClocksNaive( c1, c2 )
{
    if( !( c1.size === c2.size ) )
    {
        throw new Error( "bad matrices" );
    }
    const merged_matrix = T.map();
    for( [ teammate_a, vector_clock1 ] in c1 )
    {
        if( !( c2.has( teammate_a ) ) )
        {
            throw new Error( "bad matrices" );
        }
        const vector_clock2 = c2.get( teammate_a );
        if( !( vector_clock1.size === vector_clock2.size ) )
        {
            throw new Error( "bad matrices" );
        }
        const merged_vector = T.map();
        for( [ teammate_b, serial_num1 ] in vector_clock1 )
        {
            if( !( vector_clock2.has( teammate_b ) ) )
            {
                throw new Error( "bad matrices" );
            }
            const serial_num2 = vector_clock2.get( teammate_b );
            merged_serial_num = Math.max( serial_num1, serial_num2 );
            merged_vector.set( teammate_b, merged_serial_num );
        }
        merged_matrix.set( teammate_a, merged_vector );
    }
    return merged_matrix;
}

export function mergeMatrixClocksPrevPtrs( edit_partial_order, c1, c2 )
{
    // c1 and c2 are maps: ( teammate -> set of edit ptrs )
    if( !( c1.size === c2.size ) )
    {
        throw new Error( "bad matrices" );
    }
    const merged_matrix = T.map();
    console.log( "c1", c1.toString() )
    for( const [ teammate, vector_clock1 ] of c1 )
    {
        if( !( c2.has( teammate ) ) )
        {
            throw new Error( "bad matrices " + teammate );
        }
        const vector_clock2 = c2.get( teammate );
        const merged_vector = mergePrevPtrVectors(
            edit_partial_order, vector_clock1, vector_clock2 );
        merged_matrix.set( teammate, merged_vector );
    }
    return merged_matrix;
}

function mergePrevPtrVectors( dag, v1, v2 )
{
    const all_preds = UT.setUnion( T.set(), v1, v2 );
    const merged_vector = all_preds.clone();
    console.log( "WEIRD", all_preds.toString(), v1.toString() );
    for( const pred_ptr1 of all_preds )
    {
        for( const pred_ptr2 of all_preds )
        {
            const n1 = dag.get( pred_ptr1 );
            const n2 = dag.get( pred_ptr2 );
            if( depth( n1 ) >= depth( n2 ) )
            {
                // pred_ptr2 cannot imply pred_ptr1
                continue;
            }
            const found_a_path = searchForPath(
                dag, pred_ptr1, pred_ptr2, depth( n1 ) );
            if( found_a_path )
            {
                merged_vector.delete( pred_ptr1 );
                break;
            }
        }
    }

    return merged_vector;
}

function searchForPath( dag, p1, p2, depth_limit )
{
    const work_queue = [ p2 ];
    const visited = T.set();
    while( work_queue.length > 0 )
    {
        const ptr = work_queue.pop();
        console.log( "WORK", ptr );
        if( visited.has( ptr ) )
        {
            continue;
        }
        visited.add( ptr );
        // Only need to check the author, because there must
        // be a path back from [A,D] to [A,D-x]
        if( ptr[ 0 ] === p1[ 0 ] )
        {
            return true;
        }
        const n_vis = dag.get( ptr );
        if( depth( n_vis ) > depth_limit )
        {
            for( const p of preds( n_vis ) )
            {
                work_queue.unshift( p )
            }
        }
    }
    return false;
}


// 1, 4, 18, 23, 29, 36, 39

// M. Ahamad, J. Burns, P. Hutto, and G. Neiger. Causal memory. In WDAG, pages 9–30, 1991

// N. Belaramani, M. Dahlin, L. Gao, A. Nayate, A. Venkataramani, P. Yalagandula, and J. Zheng. PRACTI replication. In NSDI, 2006

// R. Golding. A weak-consistency architecture for distributed information services. Computing Systems, 5(4):379–405, 1992.

// R. Ladin, B. Liskov, L. Shrira, and S. Ghemawat. Providing high availability using lazy replication. ACM TOCS, 10(4):360–391, 1992

// W. Lloyd, M. Freedman, M. Kaminsky, and D. Andersen. Don’t settle for eventual: Stronger consistency for wide-area storage. NSDI 2011 Poster Session, Mar. 2011. http://www.cs.princeton.edu/ ̃wlloyd/papers/widekv-poster-nsdi11.pdf

// K. Petersen, M. J. Spreitzer, D. B. Terry, M. M. Theimer, and A. J. Demers. Flexible Update Propagation for Weakly Consistent Replication. In SOSP, 1997

// M. Satyanarayanan, J. Kistler, P. Kumar, M. Okasaki, E. Siegel, and D. Steere. Coda: A highly available file system for distributed workstation environments. IEEE Transactions on Computers, 39(4):447–459, Apr. 1990

