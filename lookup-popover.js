'use strict';

var entityList = {
	entities: [],
	currentIndex: 0
};

entityList.hasPrev = function() {
	return this.currentIndex > 0;
};

entityList.hasNext = function() {
	return this.currentIndex < this.entities.length - 1;
};

entityList.current = function() {
	if (this.currentIndex < this.entities.length) {
		return this.entities[this.currentIndex];
	} else {
		return null;
	}
};

entityList.currentUri = function() {
	var entity = this.current();
	if (entity) {
		return entity.entityUri;
	} else {
		return '';
	}
};

var searchActive = false;

// the selected text in the current lookup service query
var currentQuery = '';

// the current query in <q>, </q> tags plus several
// words of surrounding context.  Useful for logging purposes.
var currentQueryWithContext = '';

// interface to the PDF viewer's 'Define...' popover
var popoverController = MendeleyDesktop.module('selectedTextPopover');

// list of services for 'Source' menu used for entity search
// Each service provides a lookup() function which performs the lookup
var lookupServices = [{
		id: "wikipedia-zh",
		name: "Wikipedia-zh",
		service: new WikipediaLookupService("zh.wikipedia.org")
	}, {
		id: "wikipedia",
		name: "Wikipedia",
		service: new WikipediaLookupService("en.wikipedia.org")
   }, {
      id: "baidu-trans",
      name: "百度词典",
      service: new BaiduTransService()
   }
];
var currentLookupService = $.grep(lookupServices, function(item) {
	return item.id == "baidu-trans";
})[0];

// list of services for 'Search' menu.
// Tag names taken from OpenSearch spec:
// http://www.opensearch.org/Specifications/OpenSearch/1.1#OpenSearch_description_document
var searchServices = [{
		name: "Mendeley",
		url: 'http://www.mendeley.com/research-papers/search/?query={searchTerms}'
	}, {
		name: "Google Scholar",
		url: 'http://scholar.google.com/scholar?q={searchTerms}'
	}, {
      name: "百度",
      url: 'http://www.baidu.com/s?wd={searchTerms}'
   }, {
		name: "Google",
		url: "http://www.google.com/search?q={searchTerms}"
	}
];

var REPORT_PROBLEM_PANE = 1;
var ADD_ENTITY_PANE = 2;
var searchThrobber;

function setCurrentBottomPane(pane) {
	var reportProblemPane = $('#report-problem-pane');
	var addEntityPane = $('#add-entity-pane');

	reportProblemPane.toggle(pane == REPORT_PROBLEM_PANE);
	addEntityPane.toggle(pane == ADD_ENTITY_PANE);

	popoverController.shrinkToContents();
}

// returns a snippet from 'text' from the region [startPos, endPos]
// with several words of surrounding context and the specified region
// tagged with '<q>' and '</q>'
function tagQueryInContext(text, startPos, endPos) {
	var contextStartPos = UiUtils.wordsLeft(text, startPos, 5);
	var contextEndPos = UiUtils.wordsRight(text, endPos, 10);
	var contextLeft = text.substr(contextStartPos, startPos - contextStartPos);
	var contextRight = text.substr(endPos, contextEndPos - endPos);
	return contextLeft + "<q>" + text.substr(startPos, endPos-startPos) + "</q>" + contextRight;
}

// Query the entity lookup service with the
// current URI (if set) or the currently selected text
function startEntitySearch() {
	setCurrentBottomPane(null);

	if (!searchThrobber) {
		searchThrobber = new Throbber({
			size: 16,
			color: 'black'
		}).appendTo(document.getElementById('search-throbber'));
	}

	searchThrobber.start();
	searchActive = true;
	updateEntityList([]);

	var selection = null;
	var uri = popoverController.entityUri;

	if (uri.length == 0) {
		var pageText = popoverController.pageText;
		var selStartPos = popoverController.selectionStart;
		var selEndPos = selStartPos + popoverController.selectionLength;

		var text = pageText.substr(selStartPos, selEndPos - selStartPos);
		currentQuery = text;
		currentQueryWithContext = tagQueryInContext(pageText, selStartPos, selEndPos);

		selection = {
			text: text,
			pageId: 0,
			boundingBox: null,
			context: popoverController.pageText,
			selectionStart: popoverController.selectionStart,
			selectionLength: popoverController.selectionLength
		};
	}

	var lookupErrorBar = $('#lookup-error-info');
	lookupErrorBar.hide();

	var searchFinished = function(entities, error) {
		searchActive = false;
		searchThrobber.stop();
		updateEntityList(entities, error);
	};

	if (uri.length > 0) {
		var title = WikipediaLookupService.titleForUrl(uri);
		if (title) {
			currentLookupService.service.lookupPages([title], {} /* snippets */, function(entities) {
				searchFinished(entities, null /* error */);
			},
			function(error) {
				searchFinished([], error);
			});
		} else {
			searchFinished([], 'Unable to find definition for ' + uri);
		}
	} else {
		currentLookupService.service.lookup(selection, function(entities) {
			searchFinished(entities, null /* error */);	
		},
		function(error) {
			searchFinished([], error);	
		});
	}
}

// Update the entity information display
// to reflect the entity |item|

function updateEntityInfo(item) {
	var headerField = $('#entity-header');
	var titleField = $('#entity-title');
	var descField = $('#entity-description');
	var noDescField = $('#no-match-description');
	var searchingField = $('#searching-for-description');
	var descTextField = $('#description-text');

	if (item.searching) {
		// searching for entities
		searchingField.show();
		headerField.hide();
		descField.hide();
		noDescField.hide();
	} else if (item.text) {
		// one or more entity matches found
		searchingField.hide();
		headerField.show();
		titleField.text(item.text);
		descField.show();
		noDescField.hide();

		var description = item.description;
		if (!description || description.length === 0) {
			description = "<span class='placeholder-text'>No description is available for this entity</span>";
		}

		// if the query text is not found directly in the description of the entity,
		// show the explanation field if provided
		var explanationField = $('#match-explanation');

		if (!item.explanation || description.toLowerCase().indexOf(currentQuery.toLowerCase()) != -1) {
			explanationField.hide();
			// TODO - This is currently case sensitive
			description = description.replace(currentQuery, '<span class="searchmatch">' + currentQuery + '</span>');
		} else {
			explanationField.html(item.explanation);
			explanationField.show();
		}

		$('#description-text').html(description);
	} else {
		// no entity match found
		searchingField.hide();
		headerField.hide();
		descField.hide();
		noDescField.show();

		$('#unknown-phrase').text(UiUtils.elideText(currentQuery, 80));
		$('#unknown-phrase-link').attr('href', 'http://www.google.com/search?q=' + encodeURIComponent(currentQuery));
	}

	var readMoreLink = $('#entity-read-more-link');
	var entityInfoLinks = $('#entity-info-links');
	if (item.entityUri) {
		entityInfoLinks.show();
		readMoreLink.text(UiUtils.getPrettyUrl(item.entityUri, UiUtils.DOMAIN_ONLY));
		readMoreLink.attr('href', item.entityUri);
		readMoreLink.attr('title', 'Read more about this at ' + UiUtils.getPrettyUrl(item.entityUri));
	} else {
		entityInfoLinks.hide();
	}

	var entityImage = $('#entity-image');
	if (item.entityImage) {
		entityImage.show();
		entityImage.attr('src', item.entityImage);
	} else {
		entityImage.hide();
	}
}

// show an error in place of the entity description of 'error'
// is non-null or hide the error text and show the description
// otherwise
function updateErrorState(error) {
	var descriptionBox = $('#description-container');
	var errorInfo = $('#lookup-error-info');
	if (error) {
		descriptionBox.hide();
		errorInfo.text(error);
		errorInfo.show();
	} else {
		descriptionBox.show();
		errorInfo.hide();
	}
}

// Update the entity text and description to reflect
// the current entity
function updateEntityView(error) {
	if (entityList.entities.length > 0) {
		var item = entityList.entities[entityList.currentIndex];
		updateEntityInfo(item);
	} else {
		if (searchActive) {
			updateEntityInfo({
				searching: true
			});
		} else {
			updateEntityInfo({
				text: '',
				description: ''
			});
		}
	}

	$('#next-entity-button').attr('disabled', !entityList.hasNext());
	$('#prev-entity-button').attr('disabled', !entityList.hasPrev());

	updateErrorState(error);
}

// Update the list of matching results for the current selection
// and display the first (highest-scoring) entity in the list

function updateEntityList(entities, error) {
	entityList.entities = entities;
	entityList.currentIndex = 0;

	var topUri = '';
	if (entities.length > 0) {
		topUri = entities[0].entityUri;
	}

	if (currentQuery != '') {
		popoverController.logEntitySearchFinished(currentQueryWithContext,
		  entities.length, topUri);
	}

	updateEntityView(error);

	// when we receive an updated list, shrink the view to fit
	// the first item. If the user browses to an item with larger text
	// the view will resize
	popoverController.shrinkToContents();
}

$(document).ready(function() {

	// only show the CODE-project specific UI features
	// if the feature flag is enabled
	if (popoverController.enableCodeProjectFeatures) {
		$('.code-project-ui').show();
	}

	$('#save-button').click(function() {
		var currentEntity = entityList.current();
		var uri = '';
		if (currentEntity) {
			uri = currentEntity.entityUri;
		}
		console.log("Saving entity: " + uri);
		popoverController.saveEntityToNotes(uri);
	});

	var logEntityBrowse = function() {
		popoverController.logEntityBrowse(currentQueryWithContext, entityList.currentUri(), entityList.currentIndex, entityList.entities.length);
	}

	$('#prev-entity-button').click(function() {
		if (entityList.hasPrev()) {
			--entityList.currentIndex;
			updateEntityView();
			logEntityBrowse();
		}
	});

	$('#next-entity-button').click(function() {
		if (entityList.hasNext()) {
			++entityList.currentIndex;
			updateEntityView();
			logEntityBrowse();
		}
	});

	var entitySearchLink = $('#entity-search-link');
	entitySearchLink.click(function(event) {
		var offset = UiUtils.dropDownMenuOffset(entitySearchLink);
		var menuItem = MendeleyDesktop.module('ui').showMenu(
			offset.left,
			offset.top,
			searchServices.map(function(service) {
			return service.name;
		}));

		var item = entityList.entities[entityList.currentIndex];
		if (menuItem != -1) {
			var searchUrl = searchServices[menuItem].url.replace('{searchTerms}', currentQuery);
			MendeleyDesktop.openUrl(searchUrl);
		}
	});

	$('#entity-source-link').click(function(event) {
		var sourceNames = [];
		var currentServiceIndex = -1;
		lookupServices.forEach(function(service, index) {
			sourceNames.push(service.name);
			if (service == currentLookupService) {
				currentServiceIndex = index;
			}
		});
		var offset = UiUtils.dropDownMenuOffset($('#entity-source-link'));
		var menuItem = MendeleyDesktop.module('ui').showMenu(offset.left, offset.top, sourceNames, currentServiceIndex);
		if (menuItem != -1) {
			currentLookupService = lookupServices[menuItem];
			startEntitySearch();
		}
	});

	$('#entity-report-link').click(function() {
		setCurrentBottomPane(REPORT_PROBLEM_PANE);
	});

	$('#add-entity-link').click(function() {
		setCurrentBottomPane(ADD_ENTITY_PANE);
	});

	$('#add-entity-button').click(function() {
		setCurrentBottomPane(null);
	});

	$('#report-problem-submit').click(function() {
		setCurrentBottomPane(null);
	});

	$('#entity-read-more-link').click(function() {
		popoverController.logEntityPageVisit(currentQueryWithContext, entityList.currentUri(), entityList.currentIndex, entityList.entities.length);
	});

	popoverController.entitySearchRequested.connect(function(text) {
		startEntitySearch();
	});

	popoverController.definitionRequested.connect(function(uri) {
		startEntitySearch();
	});

	// if we already have a selection when the view is loaded,
	// start an entity search
	if (popoverController.selectionStart != -1 || popoverController.entityUri.length > 0) {
		startEntitySearch();
	}
});
