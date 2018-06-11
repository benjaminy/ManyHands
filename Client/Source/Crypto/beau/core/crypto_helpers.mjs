import  WebCrypto from "node-webcrypto-ossl";
import TextEncoder from "text-encoding";

const Encoder = new TextEncoder.TextEncoder();
// const encode = Encoder.encode.bind(Encoder);

const Decoder = new TextEncoder.TextDecoder('utf-8');

const WC = new WebCrypto();
const CS = WC.subtle;

export async function key_to_buffer(key) {
    let key_object = await CS.exportKey("jwk", key);
    let key_string = JSON.stringify(key_object);
    let key_buffer = Encoder.encode(key_string);
    // let key_buffer = encode(key_string);
    return key_buffer;

}

export function combine_typed_arrays(typed_arrays) {
    let total_number_of_bits = 0;

    for (let i = 0; i < typed_arrays.length; i++) {
        total_number_of_bits += typed_arrays[i].length;
    }

    let output = new Uint32Array(total_number_of_bits);
    let offset = 0;

    for (let i = 0; i < typed_arrays.length; i++) {
        output.set(typed_arrays[i], offset);
        offset += typed_arrays[i].length;
    }

    return output;
}
