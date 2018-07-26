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
    const signature = await CS.sign(meta_info, signing_key, data_to_sign);
    return signature;
}

export async function verify(meta_info, sign_public_key, signature, signed_data) {
    const verify = await CS.verify( meta_info, sign_public_key, signature, signed_data);
    return verify;
}

export async function derive_bits(derivation_object, key, bit_length) {
    const output = await CS.deriveBits(derivation_object, key, bit_length);
    return output;
}

export async function generate_key(key_meta_info, exportable, key_ops) {
    const keypair = await CS.generateKey(key_meta_info, exportable, key_ops);

    return keypair;
}

export async function encrypt(algorithm_info, key, buffer) {
    const encryption = await CS.encrypt(algorithm_info, key, buffer);
    return encryption;
}

export async function decrypt(algorithm_info, key, cipher_text) {
    const decryption = await CS.decrypt(
        algorithm_info, key, cipher_text
    );

    return decryption;
}

export async function digest(hash_function_obj, incoming_buffer) {
    const hash_buffer = await CS.digest(hash_function_obj, incoming_buffer);
    return hash_buffer;
}
