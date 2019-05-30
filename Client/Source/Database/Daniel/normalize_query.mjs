import * as Q from '../query.mjs';
import * as K from '../../Utilities/keyword.mjs';

/**
 * There are several assumptions that the database engine has to make while executing a query.
 *
 * For example, there are 6 implicit parameters in a :where clause, and it is possible to only pass in
 * 2-3 for the query to still be valid. The :in clause can be omitted, or the syntax can be wrong altogether.
 *
 * This function intends to normalize the query into a more comprehensive and complete JavaScript object
 * that can be inspected while executing the query.
 *
 * @param query a list-format query in Datalog-ish format. For example, the following array:
 *     [':find', ['?e', '?x'], ':where', ['?e', ':eats', '?x']]
 */
function normalize_and_validate(query){
    if(query.length % 2 === 0){
        throw new Error("Malformed query: size is not even");
    }
    const expanded = {};
    for(let i = 0; i < query.length; i += 2){ // iterate, where i hits the first of every pair of two elements
        if(K.compare(K.key(query[i]), Q.findK)){  // is this key :find?
            const find_keys = query[i+1];
            for(let j = 0; j < find_keys; j++){
                assert(find_keys[k].startsWith('?'));
            }
            expanded.find = find_keys;
        }
        // other base-level parameters: :where, :in, :with...
    }
    if(!'in' in expanded){
        expanded.in = ['$'];
    }
}

export default function init(){
    return normalize_and_validate;
}
