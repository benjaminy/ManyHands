import {init_simple_dict, compareDatom} from './data_wrapper.mjs';
import * as K from '../../Utilities/keyword.mjs';
import assert  from "../../Utilities/assert";

const simple_dict = init_simple_dict();

const susan = simple_dict.add({
    entity: 1,
    attribute: K.key(':age'),
    value: 1000
});

assert(simple_dict.find().length === 1);

assert(compareDatom(simple_dict.find({entity: 1})[0], susan));
assert(simple_dict.find({entity: 2}).length === 0);

assert(compareDatom(simple_dict.find({attribute: K.key( ':age')})[0], susan));
assert(simple_dict.find({attribute: K.key(':name')}).length === 0);

assert(compareDatom(simple_dict.find({value: 1000})[0], susan));
assert(simple_dict.find({value: 72}).length === 0);

console.log("All tests completed");
