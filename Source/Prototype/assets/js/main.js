	var CLIENT_ID = '609410117719-2cpaht834f4kjbaivkt2v1s03to7s9r8.apps.googleusercontent.com';
	var SCOPES = ["https://www.googleapis.com/auth/drive"];


	//document.getElementById("submit").onclick = readFile;
	var fileName="";
	//document.getElementById("gdrive_connect").onclick = handleAuthClick;
	
	//document.getElementById("getPublink").onclick = getPubLink;
	document.getElementById("keyGenerate").onclick = initializeKeys;
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
	const boundary = '-------314159265358979323846';
	const delimiter = "\r\n--" + boundary + "\r\n";
 	const close_delim = "\r\n--" + boundary + "--";

	window.onload = checkAuth;


	function checkAuth(){
		gapi.auth.authorize(
		{
			'client_id': CLIENT_ID,
			'scope': SCOPES,
			'immediate': true
		}, handleAuthResult);
	}

	function handleAuthResult(authResult){
		var authDiv = document.getElementById('authorize-div');
		if(authResult && !authResult.error){
			authDiv.style.display='none';
			loadDriveApi();
		}
		else{
			authDiv.style.display='inline';
		}
	}


	function handleAuthClick(e){
		gapi.auth.authorize(
        	{client_id: CLIENT_ID, scope: SCOPES, immediate: false},
        	handleAuthResult);
        return false;
	}

	function loadDriveApi(){
		gapi.client.load('drive','v2')
	}

	function listFiles(){
		var request = gapi.client.drive.files.list({
			'maxResults':10
		});

		request.execute(function(resp){
			appendPre('Files:');
			var files = resp.items;
			if(files && files.length>0){
				for(var i=0; i<files.length; i++){
					var file = files[i];
					appendPre(file.title+' ('+file.id+')');
				}
			}
			else{
				appendPre('No files found.');
			}
		});
	}

	function appendPre(message){
		var pre = document.getElementById('output');
		var textContent = document.createTextNode(message+'\n');
		pre.appendChild(textContent);
	}

	// if(window.location.hash){

	// 	var params = parseqs(window.location.hash.substring(1));
	// 	if(params.error){
	// 		document.write("Error "+params.error+": "+params.error_description.replace(/\+/g,' '));
	// 	}
	// 	else{
	// 		access_token = parseqs(window.location.hash.substring(1)).access_token;
	// 		uid = parseqs(window.location.hash.substring(1)).uid;
	// 		window.location.hash = "";
	// 		localStorage.setItem('access_token', access_token);
	// 		sessionStorage.setItem('uid', uid);
	// 	}
	// }	
	
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
		// keyUploadRequest(salt2, "salt2");
		// keyUploadRequest(pem, "pubKey");
		// keyUploadRequest(privKey, "privKey");
	}


	function keyUploadRequest(requestData, filename, callback){
		var metadata = {
			'title': filename
		};

		var uploadRequest = delimiter+ JSON.stringify(metadata)+delimiter+requestData+close_delim;

		var request = gapi.client.request({
			'path': '/upload/drive/v2/files',
			'method':'POST',
			'params':{'uploadType':'multipart'},
			'body':uploadRequest
		});
		
		if(!callback){
			callback = function(file){
				console.log(file)
			};
		}
		request.execute(callback);
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
		console.log("downloading key");
		makeDownloadRequest("privKey", keyCallBack);
		makeDownloadRequest("salt1", salt1CallBack);
		makeDownloadRequest("salt2", salt2CallBack);
	}

	function getPubLink(){
		var xmlhttp = new XMLHttpRequest();

		xmlhttp.onreadystatechange = makeFooCB(publinkCallBack);

		xmlhttp.open("POST", "https://api.dropbox.com/1/shares/auto/"+"salt1",true);
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

	function makeFooCB(cb){
		return function(ev){
			foo(this, cb);
		}
	}

	function keyCallBack(httpResponse){
		encryptedPrivKey = httpResponse;
	}

	function publinkCallBack(httpResponse){
		publink = httpResponse;
		console.log(publink);
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
