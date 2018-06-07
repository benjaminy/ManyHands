const WebCrypto = require("node-webcrypto-ossl");
const WC = new WebCrypto();
const CS = WC.subtle;

async function main() {
    let my_password =  new Int32Array([1490779259, -1036741813, 2138014120,
        -1458188715, -1663956756, 1240908949, 135951678, 1156917335 ]);
    let my_salt = new Uint8Array([ 24, 22, 216, 28, 141, 50, 44, 115,
                                    117, 65, 243, 62, 117, 42, 115, 78 ]);
    for (i = 0; i < 5; i++) {

        let kdf_key = await CS.importKey(
            "raw", my_password, {name: "PBKDF2"},
            false, ["deriveKey", "deriveBits"]
        );

        let next_bits = await CS.deriveBits(
            { "name": "PBKDF2", salt: my_salt, iterations: 1000, hash: {name: "SHA-1"} },
            kdf_key, 256
        );

        my_password = new Int32Array(next_bits);
        console.log(my_password);
        console.log("***************");
    }

}

main();
