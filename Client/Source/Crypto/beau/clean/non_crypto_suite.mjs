import assert from "assert"

import WebCrypto from "node-webcrypto-ossl";
const WC = new WebCrypto();
const CS = WC.subtle;

export async function export_key(key_type, crypto_key) {
    const exported_key = await CS.exportKey(key_type, crypto_key);
    return exported_key;
}

export async function import_key(key_data_type, key_object, algorithm_name, exportable, key_ops) {
    const crypto_key = await CS.importKey(key_data_type, key_object, algorithm_name, exportable, key_ops);
    return crypto_key;
}

export async function sign(meta_info, signing_key, data_to_sign) {
    const return_val = await WC.getRandomValues(new Uint8Array(32)).buffer;
    return return_val;
}

export async function verify(meta_info, sign_public_key, signature, signed_data) {
    return true
}

//PROBLEM CHILD
export async function derive_bits(derivation_object, key, bit_length) {
    const return_val = await WC.getRandomValues(new Uint8Array(
        [ 161, 118, 128, 90, 43, 179, 86, 211, 246, 129, 176, 44, 65, 204, 82, 126,
        161, 118, 128, 90, 43, 179, 86, 211, 246, 129, 176, 44, 65, 204, 82, 126]
    )).buffer;

    return return_val;
}

export async function generate_key(key_meta_info, exportable, key_ops) {
    const keypair = await CS.generateKey(key_meta_info, exportable, key_ops);

    return keypair;
}

export async function encrypt(algorithm_info, key, buffer) {
    return buffer
}

export async function decrypt(algorithm_info, key, cipher_text) {
    return cipher_text
}

export async function digest(hash_function_obj, incoming_buffer) {
    const hash_buffer = await CS.digest(hash_function_obj, incoming_buffer);
    return hash_buffer;
}
