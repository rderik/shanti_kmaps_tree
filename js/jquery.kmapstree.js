// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
;(function ($, window, document, undefined) {

    "use strict";

    // undefined is used here as the undefined global variable in ECMAScript 3 is
    // mutable (ie. it can be changed by someone else). undefined isn't really being
    // passed in so we can ensure the value of it is truly undefined. In ES5, undefined
    // can no longer be modified.

    // window and document are passed through as local variable rather than global
    // as this (slightly) quickens the resolution process and can be more efficiently
    // minified (especially when both are regularly referenced in your plugin).

    // Create the defaults once
    var pluginName = "kmapsTree",
        defaults = {
            termindex_root: "http://kidx.shanti.virginia.edu/solr/termindex-dev-update",
            kmindex_root: "http://kidx.shanti.virginia.edu/solr/kmindex-dev",
            type: "subjects",
            baseUrl: "http://subjects.kmaps.virginia.edu/"
        };

    // The actual plugin constructor
    function Plugin(element, options) {
        this.element = element;
        // jQuery has an extend method which merges the contents of two or
        // more objects, storing the result in the first object. The first object
        // is generally empty as we don't want to alter the default options for
        // future instances of the plugin
        this.settings = $.extend({}, defaults, options);
        this._defaults = defaults;
        this._name = pluginName;
        this.init();
    }

    // Avoid Plugin.prototype conflicts
    $.extend(Plugin.prototype, {
        init: function () {
            // Place initialization logic here
            // You already have access to the DOM element and
            // the options via the instance, e.g. this.element
            // and this.settings
            // you can add more functions like the one below and
            // call them like so: this.yourOtherFunction(this.element, this.settings).
            var plugin = this;
            $(this.element).append($("<div>").text(plugin.settings.termindex_root),$("<div>").text(plugin.settings.kmindex_root)) ;
            $(this.element).fancytree({
                extensions: ["filter", "glyph"],
                quicksearch: true,
                checkbox: false,
                selectMode: 2,
                theme: 'bootstrap',
                debugLevel: 1,
                // autoScroll: true,
                autoScroll: false,
                filter: {
                    mode: "hide",
                    leavesOnly: false
                },
                activate: function (event, data) {

                    //console.log("ACTIVATE:");
                    //console.dir(data);
                    // event.preventDefault();
                    var listitem = $("td[kid='" + data.node.key + "']");
                    $('.row_selected').removeClass('row_selected');
                    $(listitem).closest('tr').addClass('row_selected');

                    var url = location.origin + location.pathname.substring(0, location.pathname.indexOf(plugin.settings.type)) + plugin.settings.type + '/' + data.node.key + '/overview/nojs';
                    $(data.node.span).find('#ajax-id-' + data.node.key).trigger('navigate');
                },
                createNode: function (event, data) {
                    //console.log("createNode: " + data.node.span)
                    //console.dir(data);
                    data.node.span.childNodes[2].innerHTML = '<span id="ajax-id-' + data.node.key + '">' + data.node.title + '</span>';

                    //console.log("STATUS NODE: " + data.node.isStatusNode());
                    //data.node.span.childNodes[2].innerHTML = '<span id="ajax-id-' + data.node.key + '">' + data.node.title + '</span>';
                    var path = $.makeArray(data.node.getParentList(false, true).map(function (x) {
                        return x.title;
                    })).join("/");

                    var theElem = data.node.span;
                    var theKey = data.node.key;
                    var theType = plugin.settings.type;
                    var theTitle = data.node.title;
                    var theCaption = data.node.data.caption;

                    // decorateElementWithPopover(theElem, theKey,theTitle, path,theCaption );
                    // decorateElemWithDrupalAjax(theElem, theKey, theType);

                    return data;
                },
                renderNode: function (event, data) {
                    data.node.span.childNodes[2].innerHTML = '<span id="ajax-id-' + data.node.key + '">' + data.node.title + '</span>';
                    if (!data.node.isStatusNode()) {
                        data.node.span.childNodes[2].innerHTML = '<span id="ajax-id-' + data.node.key + '">' + data.node.title + '</span>';
                        var path = $.makeArray(data.node.getParentList(false, true).map(function (x) {
                            return x.title;
                        })).join("/");

                        //decorateElementWithPopover(data.node.span, data.node.key,data.node.title, path, data.node.data.caption);
                        $(data.node.span).find('#ajax-id-' + data.node.key).once('nav', function () {
                            var base = $(this).attr('id');
                            var argument = $(this).attr('argument');
                            var url = location.origin + location.pathname.substring(0, location.pathname.indexOf(plugin.settings.type)) + settings.type + '/' + data.node.key + '/overview/nojs';
                            Drupal.ajax[base] = new Drupal.ajax(base, this, {
                                url: url,
                                event: 'navigate',
                                progress: {
                                    type: 'throbber'
                                }
                            });
                        });
                    }

                    return data;
                },
                glyph: {
                    map: {
                        doc: "",
                        docOpen: "",
                        error: "glyphicon glyphicon-warning-sign",
                        expanderClosed: "glyphicon glyphicon-plus-sign",
                        expanderLazy: "glyphicon glyphicon-plus-sign",
                        // expanderLazy: "glyphicon glyphicon-expand",
                        expanderOpen: "glyphicon glyphicon-minus-sign",
                        // expanderOpen: "glyphicon glyphicon-collapse-down",
                        folder: "",
                        folderOpen: "",
                        loading: "glyphicon glyphicon-refresh"
                        //              loading: "icon-spinner icon-spin"
                    }
                },
                source: {
                    url: plugin.settings.termindex_root + "/select?wt=json&indent=true&fq=tree%3Asubjects&fl=*&rows=50&q=level_i:1"
                },
                postProcess: function (event, data) {
                    // console.dir(data.response);
                    data.result = [];

                    var docs = data.response.response.docs;

                    $.each(docs, function() {
                        data.result.push(
                            {
                                key: this.id,
                                title: this.header + "(" + this.id + ")",
                                path: this.ancestor_id_path,
                                level: this.level_i,
                                lazy: true
                            });
                    });
                },

                lazyLoad: function (event,data) {
                    var id = data.node.key;
                    console.dir(data);
                    data.result = {
                        url: plugin.settings.termindex_root + "/select?wt=json&indent=true&fq=tree%3Asubjects&fl=*&rows=50&q=ancestor_id_path:" + data.node.data.path + " AND level_i:" + (1+data.node.data.level),
                    }
                },
                focus: function (event, data) {
                    data.node.scrollIntoView(true);
                    data.node.scrollIntoView(true);
                },
                create: function(evt,ctx) {

                },

                loadChildren: function(evt,ctx) {
                    var startId = plugin.settings.termindex_root_id;

                    if (startId) {
                        //ctx.tree.activateKey(startId);
                        var startNode = ctx.tree.getNodeByKey(startId);
                        if (startNode) {
                            console.log("autoExpanding node: " + startNode.title + " (" + startNode.key + ")");
                            try {
                                startNode.setExpanded(true);
                                startNode.makeVisible();
                            } catch( e ) { console.error ("autoExpand failed: " + e.toString())}
                        }
                    }
                    //}
                },
                cookieId: "kmaps1tree", // set cookies for search-browse tree, the first fancytree loaded
                idPrefix: "kmaps1tree"
            });


            function decorateElementWithPopover(elem, key, title, path, caption) {
                //console.log("decorateElementWithPopover: "  + elem);
                if (jQuery(elem).popover) {
                    jQuery(elem).attr('rel', 'popover');

                    //console.log("caption = " + caption);
                    jQuery(elem).popover({
                            html: true,
                            content: function () {
                                caption = ((caption) ? caption : "");
                                var popover = "<div class='kmap-path'>/" + path + "</div>" + "<div class='kmap-caption'>" + caption + "</div>" +
                                    "<div class='info-wrap' id='infowrap" + key + "'><div class='counts-display'>...</div></div>";
                                //console.log("Captioning: " + caption);
                                return popover;
                            },
                            title: function () {
                                return title + "<span class='kmapid-display'>" + key + "</span>";
                            },
                            trigger: 'hover',
                            placement: 'left',
                            delay: {hide: 5},
                            container: 'body'
                        }
                    );

                    jQuery(elem).on('shown.bs.popover', function (x) {
                        $("body > .popover").removeClass("related-resources-popover"); // target css styles on search tree popups
                        $("body > .popover").addClass("search-popover"); // target css styles on search tree popups

                        var countsElem = $("#infowrap" + key + " .counts-display");

                        // highlight matching text (if/where they occur).
                        var txt = $('#searchform').val();
                        // $('.popover-caption').highlight(txt, {element: 'mark'});

                        $.ajax({
                            type: "GET",
                            url: plugin.settings.baseUrl + "/features/" + key + ".xml",
                            dataType: "xml",
                            timeout: 90000,
                            beforeSend: function () {
                                countsElem.html("<span class='assoc-resources-loading'>loading...</span>");
                            },
                            error: function (e) {
                                countsElem.html("<i class='glyphicon glyphicon-warning-sign' title='" + e.statusText);
                            },
                            success: function (xml) {

                                // force the counts to be evaluated as numbers.
                                var related_count = Number($(xml).find('related_feature_count').text());
                                var description_count =  Number($(xml).find('description_count').text());
                                var place_count =  Number($(xml).find('place_count').text());
                                var picture_count = Number($(xml).find('picture_count').text());
                                var video_count = Number($(xml).find('video_count').text());
                                var document_count = Number($(xml).find('document_count').text());
                                var subject_count = Number($(xml).find('subject_count').text());

                                if (plugin.settings.type === "places") {
                                    place_count = related_count;
                                } else if (plugin.settings.type === "subjects") {
                                    subject_count = related_count;
                                }
                                countsElem.html("");
                                countsElem.append("<span style='display: none' class='associated'><i class='icon shanticon-audio-video'></i><span class='badge' >" + video_count + "</span></span>");
                                countsElem.append("<span style='display: none' class='associated'><i class='icon shanticon-photos'></i><span class='badge' >" + picture_count + "</span></span>");
                                countsElem.append("<span style='display: none' class='associated'><i class='icon shanticon-places'></i><span class='badge' >" + place_count + "</span></span>");
                                countsElem.append("<span style='display: none' class='associated'><i class='icon shanticon-subjects'></i><span class='badge' >" + subject_count + "</span></span>");
                                countsElem.append("<span style='display: none' class='associated'><i class='icon shanticon-texts'></i><span class='badge' >" + description_count + "</span></span>");

                            },
                            complete: function () {

                                var fq = plugin.settings.solr_filter_query;

                                var project_filter = (fq)?("&" + fq):"";
                                var kmidxBase = plugin.settings.kmindex_root;
                                if (!kmidxBase) {
                                    kmidxBase = 'http://kidx.shanti.virginia.edu/solr/kmindex';
                                    console.error("Drupal.settings.shanti_kmaps_admin.shanti_kmaps_admin_server_solr not defined. using default value: " + kmidxBase);
                                }
                                var solrURL = kmidxBase + '/select?q=kmapid:' + plugin.settings.type + '-' + key + project_filter + '&start=0&facets=on&group=true&group.field=asset_type&group.facet=true&group.ngroups=true&group.limit=0&wt=json';
                                console.log ("solrURL = " + solrURL);
                                $.get(solrURL, function (json) {
                                    //console.log(json);
                                    var updates = {};
                                    var data = JSON.parse(json);
                                    $.each(data.grouped.asset_type.groups, function (x, y) {
                                        var asset_type = y.groupValue;
                                        var asset_count = y.doclist.numFound;
                                        updates[asset_type] = asset_count;
                                    });
                                    // console.log(key + "(" + title + ") : " + JSON.stringify(updates));
                                    update_counts(countsElem, updates)
                                });
                            }
                        });
                    });
                }


                function update_counts(elem, counts) {

                    var av = elem.find('i.shanticon-audio-video ~ span.badge');
                    if (typeof(counts["audio-video"]) != "undefined") {
                        (counts["audio-video"]) ? av.html(counts["audio-video"]).parent().show() : av.parent().hide();
                    }
                    if (Number(av.text()) > 0) {
                        av.parent().show()
                    }

                    var photos = elem.find('i.shanticon-photos ~ span.badge');
                    if (typeof(counts.photos) != "undefined") {
                        photos.html(counts.photos)
                    }
                    (Number(photos.text()) > 0) ? photos.parent().show() : photos.parent().hide();

                    var places = elem.find('i.shanticon-places ~ span.badge');
                    if (typeof(counts.places) != "undefined") {
                        places.html(counts.places)
                    }
                    if (Number(places.text()) > 0) {
                        places.parent().show()
                    }

                    var essays = elem.find('i.shanticon-texts ~ span.badge');
                    if (typeof(counts.texts) != "undefined") {
                        essays.html(counts["texts"])
                    }
                    if (Number(essays.text()) > 0) {
                        essays.parent().show()
                    }

                    var subjects = elem.find('i.shanticon-subjects ~ span.badge');
                    if (typeof(counts.subjects) != "undefined") {
                        subjects.html(counts.subjects)
                    }
                    if (Number(subjects.text()) > 0) {
                        subjects.parent().show()
                    }
                    elem.find('.assoc-resources-loading').hide();

                }


                return elem;
            };

            function decorateElemWithDrupalAjax(theElem, theKey, theType) {
                //console.log("decorateElementWithDrupalAjax: "  + $(theElem).html());
                $(theElem).once('nav', function () {
                    //console.log("applying click handling to " + $(this).html());
                    var base = $(this).attr('id') || "ajax-wax-" + theKey;
                    var argument = $(this).attr('argument');
                    var url = location.origin + location.pathname.substring(0, location.pathname.indexOf(theType)) + theType + '/' + theKey + '/overview/nojs';

                    var element_settings = {
                        url: url,
                        event:  'navigate',
                        progress: {
                            type: 'throbber'
                        }
                    };

                    // console.log("Adding to ajax to " + base);

                    Drupal.ajax[base] = new Drupal.ajax(base, this, element_settings);
                    //this.click(function () {
                    //    console.log("pushing state for " + url);
                    //    window.history.pushState({tag: true}, null, url);
                    //});
                });
            }



        },
        yourOtherFunction: function (elem,settings) {
            // some logic
        }
    });

    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations
    $.fn[pluginName] = function (options) {
        return this.each(function () {
            if (!$.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName, new Plugin(this, options));
            }
        });
    };

})(jQuery, window, document);
