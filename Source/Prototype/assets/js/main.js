	var APP_KEY = "rwovrjf7g18ya3b";

	//document.getElementById("submit").onclick = readFile;
	var fileName="";
	if(document.getElementById("dropbox_connect") !== null){	
		document.getElementById("dropbox_connect").onclick = handleAuthClick;
	}
	
	if(document.getElementById("getPublink") !== null){
		document.getElementById("getPublink").onclick = getPubLink;
	}
	//document.getElementById("keyGenerate").onclick = initializeKeys;
	//document.getElementById("decrypt_file").onclick = makeDownloadRequest;
	//document.getElementById("download_key").onclick = downloadKey;

	var access_token = "";
	var publink = null;
	var file_blob = null;
	var encryptedPrivKey = null;
	var sessionSalt = null;
	var pbkdSalt = null;
	var filename=null;
	var sessionKey = null;
	var authDiv = document.getElementById('authorize-div');


	window.onload = checkAuth;


	function checkAuth(){
		if(!sessionStorage.getItem('access_token')){
			authDiv.style.display='inline'	
		}
		else{
			access_token = localStorage.getItem('access_token')
		}
	}

	function get_redirect_uri(){
		return "http://localhost:8080/firstconnect.html";
	}


	function handleAuthClick(e){
        window.open('https://www.dropbox.com/1/oauth2/authorize?client_id='+encodeURIComponent(APP_KEY)+'&response_type=token&redirect_uri='+encodeURIComponent(get_redirect_uri()), "_self");
	}

	function parseqs(text){
		var split = text.split('&');
		var params = {};
		for(var i=0; i<split.length; i++){
			var kv = split[i].split('=',2);
			params[kv[0]] = kv[1];
		}
		return params;
	}

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



	
	function readFile(e){
		var contents = "";
		var input_file = document.getElementById("input_file");
		var file_encrypt = input_file.files[0];

		if(input_file.files.length!=1){
			alert('Please select a file.');
			return false;
		}
		var reader = new FileReader();
		reader.onload = function(e){
			contents = reader.result;
			encryptFile(contents);
		}
		fileName = file_encrypt.name;
		reader.readAsBinaryString(input_file.files[0]);

	}

	function encryptFile(contents){
		var encrypted_data = "";
		sessionKey = generateSessionKey();


		encrypted_data = sjcl.encrypt(sessionKey, contents);
		contents = "";
		pass="";
		fileUploadRequest(encrypted_data, fileName);
		encrypted_data = "";
	}

	function initializeKeys(){
		var pass = document.getElementById("myPsw").value;

		var rsa = forge.pki.rsa;
		
		var keypair = rsa.generateKeyPair({bits: 2048, e: 0x10001});
		
		var pem = forge.pki.publicKeyToPem(keypair.publicKey);
		
		var salt1 = forge.random.getBytesSync(128);

		var salt2 = forge.random.getBytesSync(128);

		var pbkd = forge.pkcs5.pbkdf2(pass, salt2, 40, 16);

		var privKey = forge.pki.encryptRsaPrivateKey(keypair.privateKey, pbkd);

		keyUploadRequest(salt1, "salt1");
		keyUploadRequest(salt2, "salt2");
		keyUploadRequest(pem, "pubKey");
		keyUploadRequest(privKey, "privKey");
	}


	function keyUploadRequest(requestData, filename){
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function(){
			if(xmlhttp.readyState == 4 && xmlhttp.status==200){
				alert("Uploaded keys");
			}
		}

		xmlhttp.open("POST", "https://api-content.dropbox.com/1/files_put/auto/"+filename+"?overwrite=true", true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(requestData);
	}

	function generateSessionKey(){
		var pswd = document.getElementById("myPsw").value;
		var sessionPbkd = forge.pkcs5.pbkdf2(pswd, pbkdSalt, 40, 16);

		var uEncryptedPrivKey = forge.pki.decryptRsaPrivateKey(encryptedPrivKey, sessionPbkd);
		
		var sessionkey = forge.pkcs5.pbkdf2(sessionSalt, uEncryptedPrivKey, 40, 16);

		return sessionkey;

	}

	//Actual data will go to a path depending on the team. Not to the root folder.
	function fileUploadRequest(requestData, filename){
		var teamName = "";
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function(){
			if(xmlhttp.readyState == 4 && xmlhttp.status==200){
				alert("Uploaded!");
			}
		}

		xmlhttp.open("POST", "https://api-content.dropbox.com/1/files_put/auto/"+teamName+"/"+filename+"?overwrite=true", true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(requestData);
	}

	function downloadKey(){
		makeDownloadRequest("privKey", keyCallBack);
		makeDownloadRequest("salt1", salt1CallBack);
		makeDownloadRequest("salt2", salt2CallBack);
	}

	function getPubLink(){
		var xmlhttp = new XMLHttpRequest();

		xmlhttp.onreadystatechange = makeFooCB(publinkCallBack);

		xmlhttp.open("POST", "https://api.dropbox.com/1/shares/auto/pubKey?short_url=false",true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(null);
	}


	function makeDownloadRequest(filename1, cb){
		var xmlhttp = new XMLHttpRequest();
		//filename = filename1;
		xmlhttp.onreadystatechange = makeFooCB(cb);
	
		xmlhttp.open("GET", "https://api-content.dropbox.com/1/files/auto/"+filename1+"", true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(null);

	}

	function downloadFile(download_url, cb){
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = makeFooCB(cb);

		var publicLink = download_url.replace("www.dropbox.com", "dl.dropboxusercontent.com");

		xmlhttp.open("GET", publicLink, true);
		xmlhttp.send(null)
	}

	function makeFooCB(cb){
		return function(ev){
			foo(this, cb);
		}
	}

	function downloadFileCallBack(httpResponse){
		console.log(httpResponse);
	}

	function keyCallBack(httpResponse){
		encryptedPrivKey = httpResponse;
	}

	function publinkCallBack(httpResponse){
		var linkField = document.getElementById('hidden_input');
		resp = JSON.parse(httpResponse);
		publink = resp.url;
		publink = publink.replace("www.dropbox.com", "dl.dropboxusercontent.com");
		linkField.value = publink;
	}

	function salt2CallBack(httpResponse){
		pbkdSalt = httpResponse;
	}

	function salt1CallBack(httpResponse){
		sessionSalt = httpResponse;
	}

	function foo(xhr, cb){
		if(xhr.readyState == 4 && xhr.status==200){
			cb(xhr.responseText);
		}
	}


	function decryptFile(fileBlob){
		var decrypt_pass = document.getElementById("myPsw2").value;
		var decrypted_data = sjcl.decrypt(decrypt_pass, fileBlob);
		decrypted_text.innerHTML = decrypted_data;
		decrypt_pass ="";
	}

	var obj = document.getElementById("decrypt_file");
