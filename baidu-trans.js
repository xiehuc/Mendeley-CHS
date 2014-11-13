// translation services that uses Baidu's translate APIs
// author: xiehuc<xiehuc@gmail.com>
//
var BaiduTransService = (function() {
	'use strict';
	
   function BaiduTransService() {}

   BaiduTransService._serviceDomain = "http://openapi.baidu.com"

	BaiduTransService.prototype._apiQuery = function(data, successCallback, errCallback) {
		$.ajax({
			type: "GET",
			url: BaiduTransService._serviceDomain + "/public/2.0/translate/dict/simple" ,
			dataType: "json",
			data: data,
			success: successCallback,
			error: function(xhr, status, errorThrown) {
				console.log("Baidu API error: " + status + ":" + errorThrown);
				console.log("XHR status: " + xhr.status);
				errCallback(xhr, status, errorThrown);
			}
		});
	};
	/** Search the full text of Wikipedia for articles matching the selected text in @p selection.
	 */
	BaiduTransService.prototype.lookup = function(selection, successCallback, errCallback) {

		var wordCount = selection.text.split(' ').length;

		// avoid trying to perform searches on queries that are
		// too long
		var MAX_QUERY_LENGTH = 100;
		var MAX_QUERY_WORDS = 10;

		if (selection.text.length > MAX_QUERY_LENGTH ||
			wordCount > MAX_QUERY_WORDS) {
			errCallback('Select a shorter phrase to lookup an explanation');
			return;
		}

		var query = selection.text.toLowerCase();

		var searchErrorHandler = function(error) {
			console.log("Wikipedia search failed with error: " + error);
			errCallback('Unable to search Wikipedia for matching pages: ' + error);
		}

		var self = this;
		this._apiQuery({
         from: "en",
         to: "zh",
         q: query,
         client_id: "G6ucrSYCZsB8wMvmpce5mm3Z"
		}, function(data, status) {
			if (data.errno) {
				searchErrorHandler(""+data.errno);
				return;
			}

         var entities = data.data.symbols.map(function(symbol){
            return {
               entityUri: "http://fanyi.baidu.com/#en/zh/"+data.data.word_name,
               text: data.data.word_name,
               explanation: "[英]["+symbol.ph_en+"] [美]["+symbol.ph_am+"]",
               description: symbol.parts.reduce(function(prev,cur){
                  return prev+"<br>"+cur.part+cur.means.join("; ");
               },"")
            };
         });

			successCallback(entities);

		}, function(xhr, status, errorThrown) {
			var errorText = xhr.status + ': ' + errorThrown;
			searchErrorHandler(errorText);
		});
	};

	return BaiduTransService;
})();
