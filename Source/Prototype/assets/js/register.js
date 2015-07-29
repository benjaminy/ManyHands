var APP_KEY = "rwovrjf7g18ya3b";
var access_token = "";
var publink = "";

var regform = document.getElementById('regform');

	if(window.location.hash){

		var params = parseqs(window.location.hash.substring(1));
		if(params.error){
			document.write("Error "+params.error+": "+params.error_description.replace(/\+/g,' '));
		}
		else{
			access_token = parseqs(window.location.hash.substring(1)).access_token;
			window.location.hash = "";
			localStorage.setItem('access_token', access_token);
		}
	}

	regform.onsubmit = function(evt){
		initializeKeys();
	}


	//Is there a way to make sure a certain function executes once this function completes?
	function initializeKeys(){
		var pass = document.getElementById('password').value;

		var rsa = forge.pki.rsa;
		
		var keypair = rsa.generateKeyPair({bits: 128, e: 0x10001});
		
		var pem = forge.pki.publicKeyToPem(keypair.publicKey);
		
		var salt1 = forge.random.getBytesSync(128);

		var salt2 = forge.random.getBytesSync(128);

		var pbkd = forge.pkcs5.pbkdf2(pass, salt2, 40, 16);

		var privKey = forge.pki.encryptRsaPrivateKey(keypair.privateKey, pbkd);

		keyUploadRequest(salt1, "salt1");
		keyUploadRequest(salt2, "salt2");
		keyUploadRequest(pem, "pubKey");
		keyUploadRequest(privKey, "privKey");
		//call get public link
	}

	function keyUploadRequest(requestData, filename){
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function(){
			if(xmlhttp.readyState == 4 && xmlhttp.status==200){
				console.log("uploading keys...");
			}
		}

		xmlhttp.open("POST", "https://api-content.dropbox.com/1/files_put/auto/"+filename+"?overwrite=true", true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(requestData);
	}


	function getPubLink(){
		var xmlhttp = new XMLHttpRequest();

		xmlhttp.onreadystatechange = makeFooCB(publinkCallBack);

		xmlhttp.open("POST", "https://api.dropbox.com/1/shares/auto/privKey?short_url=false",true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(null);
	}

	function publinkCallBack(httpResponse){
		var linkField = document.getElementById('hidden_input');
		resp = JSON.parse(httpResponse);
		publink = resp.url;
		publink = publink.replace("www.dropbox.com", "dl.dropboxusercontent.com");
		linkField.value = publink;
	}
