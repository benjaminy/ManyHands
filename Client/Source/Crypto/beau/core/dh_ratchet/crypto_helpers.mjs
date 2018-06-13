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

export async function generate_dh_keypair() {
    let keypair = await CS.generateKey(
        { name: "ECDH", namedCurve: "P-256"},
        true, ["deriveKey", "deriveBits"]
    );

    return keypair;
}

export async function derive_shared_secret(public_key, private_key) {
    let derived_secret = await CS.deriveBits(
        {
            name: "ECDH",
            namedCurve: "P-256",
            public: public_key,
        },
        private_key,
        256
    );
    derived_secret = new Uint32Array(derived_secret);
    return derived_secret;
}

export const my_salt = new Uint8Array([ 24, 22, 216, 28, 141, 50, 44, 115,
                                117, 65, 243, 62, 117, 42, 115, 78 ]);

export const eight_bytes = new Uint32Array(
    [389406673, 2503932576, 2945084966, 4019136162, 1404704077, 2913411635, 1021339222, 2579748903]
);
