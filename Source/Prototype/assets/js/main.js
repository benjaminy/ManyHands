	var APP_KEY = "rwovrjf7g18ya3b";

	document.getElementById("submit").onclick = readFile;
	var fileName="";

	document.getElementById("dropbox_connect").onclick = getOAuth;

	document.getElementById("decrypt_file").onclick = makeDownloadRequest;

	var decrypted_text = document.getElementById("dropbox_file");

	function get_redirect_uri() {
		return window.location.href.substring(0, window.location.href.length - window.location.hash.length).replace(/\/$/, '');
	}


	function getOAuth(e){
		window.open('https://www.dropbox.com/1/oauth2/authorize?client_id='+encodeURIComponent(APP_KEY)+'&response_type=token&redirect_uri='+encodeURIComponent(get_redirect_uri()), "_self");
	}

	function parseqs(text) {
		var split = text.split('&');
		var params = {};
		for (var i = 0; i < split.length; i++) {
			var kv = split[i].split('=', 2);
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
		fileName = file_encrypt.name + ".encrypted";
		reader.readAsBinaryString(input_file.files[0]);

	}

	function encryptFile(contents){
		var encrypted_data = "";
		var pass = document.getElementById("myPsw").value;
		var pass2 = document.getElementById("myPsw2").value;
		if(pass.length<3){
			alert("Please select a longer password.");
			return false;
		}
		encrypted_data = sjcl.encrypt(pass, contents);
		contents = "";
		pass="";
		makeUploadRequest(encrypted_data);
		encrypted_data = "";
		//obj.innerHTML = encrypted_data;
	}


	function makeUploadRequest(requestData){
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function(){
			if(xmlhttp.readyState == 4 && xmlhttp.status==200){
				alert("Uploaded!");
			}
		}

		xmlhttp.open("POST", "https://api-content.dropbox.com/1/files_put/auto/"+fileName+"?overwrite=true", true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(requestData);
	}

	function makeDownloadRequest(e){
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function(){
			if(xmlhttp.readyState == 4 && xmlhttp.status==200){
				alert("success!");
				var file_blob = xmlhttp.responseText;
				decryptFile(file_blob);
			}
		}
		
		xmlhttp.open("GET", "https://api-content.dropbox.com/1/files/auto/"+"TEST.encrypted", true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(null);
	}

	function decryptFile(fileBlob){
		var decrypt_pass = document.getElementById("myPsw2").value;
		var decrypted_data = sjcl.decrypt(decrypt_pass, fileBlob);
		decrypted_text.innerHTML = decrypted_data;
		decrypt_pass ="";
	}

	var obj = document.getElementById("decrypt_file");
