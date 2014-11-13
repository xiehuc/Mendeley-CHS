// lookup services that uses Wikipedia's search APIs
// - See http://www.mediawiki.org/wiki/API:Search for documentation on the API itself
// - See http://www.mediawiki.org/wiki/API:Etiquette for guidelines on polite
// usage
var WikipediaLookupService = (function() {
	'use strict';
	
	function WikipediaLookupService(domain) {
      this._serviceDomain = "http://" + domain;
   }

	WikipediaLookupService.prototype._apiQuery = function(data, successCallback, errCallback) {
		$.ajax({
			type: "GET",
			url: this._serviceDomain + "/w/api.php",
			dataType: "json",
			data: data,
			success: successCallback,
			error: function(xhr, status, errorThrown) {
				console.log("Wikipedia API error: " + status + ":" + errorThrown);
				console.log("XHR status: " + xhr.status);
				errCallback(xhr, status, errorThrown);
			}
		});
	};

	WikipediaLookupService._urlForTitle = function(domain, title) {
		return domain + "/wiki/" + encodeURIComponent(title);
	};

	/** Returns the page title for a given URL.
	 * The supported URLs may be en.wikipedia.org URLs
	 */
	WikipediaLookupService.titleForUrl = function(url) {
		var urlPatterns = [
			'[^.]+.wikipedia.org/wiki/(.*)',
			'dbpedia.org/page/(.*)',
			'dbpedia.org/resource/(.*)'
		];

		var title = null;
		urlPatterns.forEach(function(pattern) {
         console.log(url);
			var result = url.match(pattern);
         console.log(result);
			if (result) {
				title = decodeURIComponent(result[1]);
			}
		});
		
		return title;
	};

	// fetch extracts for a given set of Wikipedia page titles
	WikipediaLookupService.prototype._fetchExtracts = function(titles, successCallback, errCallback) {
		if (titles.length === 0) {
			successCallback([]);
			return;
		}

		var disambigCategories = [
				"Category:Disambiguation pages",
				"Category:Letter-number combination disambiguation pages"
		];

		// Fetch extracts, excluding disambiguation pages.
		// - http://www.mediawiki.org/wiki/API:Properties#categories_.2F_cl
		// - http://stackoverflow.com/questions/9684314/how-to-know-if-the-wikipedia-content-from-api-contains-an-useful-article-or-an-a
		this._apiQuery({
			action: "query",
			prop: "extracts|categories",
			exintro: 1,
			exlimit: "max",
			format: "json",
			titles: titles.join('|'),
			clcategories: disambigCategories.join('|')
		}, function(data, status) {
			var extracts = [];
			var pageMap = data.query.pages;
			Object.keys(pageMap).forEach(function(pageId) {
				var pageEntry = pageMap[pageId];

				var isDisambiguationPage = pageEntry.categories && pageEntry.categories.length > 0;
				if (!isDisambiguationPage) {
					extracts.push({
						title: pageEntry.title,
						extract: pageEntry.extract
					});
				}
			});

			// sort entries in the order they were returned by the original
			// search
			extracts.sort(function(a, b) {
				return titles.indexOf(a.title) - titles.indexOf(b.title);
			});

			successCallback(extracts);
		}, function(xhr, status, errorThrown) {
			errCallback(xhr, status, errorThrown);
		});
	};

	/** Fetch a description from a given Wikipedia URL */
	WikipediaLookupService.prototype.fetchExtract = function(uri, callback) {
		var title = this.titleForUrl(uri);
		if (!title) {
			return;
		}
		this._fetchExtracts([title], function(extracts) {
			if (extracts.length > 0) {
				callback(extracts[0]);
			}
		}, function() {});
	};

	/** Fetch full titles and descriptions for a given set of page titles.
	 *
	 * @p titles is an array of page titles (as they appear in Wikipedia page URIs)
	 * @p snippets is a map from page title to a snippet of the page text, this can
	 *  be used to show the reason for inclusion of a particular page in search results.
	 */
	WikipediaLookupService.prototype.lookupPages = function(titles, snippets, successCallback, errCallback) {
      var domain = this._serviceDomain;
		this._fetchExtracts(
			titles, function(extracts) {
			var entities = [];
			extracts.forEach(function(extract) {
				entities.push({
					text: extract.title,
					entityUri: WikipediaLookupService._urlForTitle(domain, extract.title),
					description: extract.extract,
					explanation: snippets[extract.title]
				});
			});
			successCallback(entities);
		}, function() {
			errCallback('Unable to fetch extracts for matching pages');
		});
	};

	/** Search the full text of Wikipedia for articles matching the selected text in @p selection.
	 */
	WikipediaLookupService.prototype.lookup = function(selection, successCallback, errCallback) {

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

		var query = selection.text;

		var searchErrorHandler = function(error) {
			console.log("Wikipedia search failed with error: " + error);
			errCallback('Unable to search Wikipedia for matching pages: ' + error);
		}

		var self = this;
		this._apiQuery({
			action: "query",
			list: "search",
			srsearch: query,
			srprop: "timestamp|snippet",
			srlimit: 10,
			format: "json"
		}, function(data, status) {
			if (data.error) {
				searchErrorHandler(data.error.info);
				return;
			}

			var titles = [];
			var snippets = {};
			data.query.search.forEach(function(result) {
				titles.push(result.title);
				snippets[result.title] = result.snippet;
			});

			self.lookupPages(titles, snippets, successCallback, errCallback);
			
		}, function(xhr, status, errorThrown) {
			var errorText = xhr.status + ': ' + errorThrown;
			searchErrorHandler(errorText);
		});
	};

	return WikipediaLookupService;
})();
