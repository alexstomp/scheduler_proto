/* JQuery Extensions */

(function ($, undefined) {
    $.fn.getCursorPosition = function() {
        var el = $(this).get(0);
        var pos = 0;
        if ('selectionStart' in el) {
            pos = el.selectionStart;
        } else if ('selection' in document) {
            el.focus();
            var Sel = document.selection.createRange();
            var SelLength = document.selection.createRange().text.length;
            Sel.moveStart('character', -el.value.length);
            pos = Sel.text.length - SelLength;
        }
        return pos;
    }

    $.fn.selectRange = function(start, end) {
        if(!end) end = start;
        return this.each(function() {
            if (this.setSelectionRange) {
                this.focus();
                this.setSelectionRange(start, end);
            } else if (this.createTextRange) {
                var range = this.createTextRange();
                range.collapse(true);
                range.moveEnd('character', end);
                range.moveStart('character', start);
                range.select();
            }
        });
    }
})(jQuery);

/* mixin the make function, removed in 0.9.2 */
_.extend(Backbone.View.prototype, {
    make: function(tagName, attributes, content) {
        var el = document.createElement(tagName);
        if (attributes) $(el).attr(attributes);
        if (content) $(el).html(content);
        return $(el);
    }
});

/* mixin the only function */
_.extend(Backbone.Collection.prototype, {
    only: function() {
        var picks = arguments;
        return this.map(function(file_model) {
            return file_model.pick.apply(file_model, picks);
        });
    }
});

_.mixin({
    /*
        _.move - takes array and moves item at index and moves to another index
    */

    move: function (array, from, to) {
        array.splice(to, 0, array.splice(from, 1)[0]);
        return array;
    },

    /*
        _.interval - calls a function once, and then again after each interval
    */

    interval: function(func, interval) {
        /* initial call */
        func();
        return window.setInterval(func, interval);
    },

    /*
    *  _.bindObj - bind all of an objects functions to a particular context.
    */

    bindObj: function(obj) {
        _.bindAll.apply(_, [obj].concat(_.functions(obj)));
    },

    /*
    *  _.passthrough - allows the first call to pass through, then delays for a certain amount of time
    */

    passthrough: function(func, wait) {
        var previous = new Date();
        var result = null;

        return function() {
            var now = new Date();
            var remaining = wait - (now - previous);
            var context = this;
            var args = arguments;

            if (remaining <= 0) {
                previous = now;
                result = func.apply(context, arguments);
            }

            return result;
        };
    },

    /*
    * _.template - creates a common abstraction for creating templates
    */

    template: function(source_el) {
        /* Templates */
        var template = source_el.html();
        Mustache.parse(template);
        return function(attrs) {
            return Mustache.render(template, attrs);
        };
    },

    /*
    * _.url_params - parses parameters from a given url and returns them as a javascript object
    */

    url_params: function(url) {
        /* defaults */
        url = url || window.location.href;

        /* vars */
        var vars = [], hash;
        var hashes = url.slice(url.indexOf('?') + 1).split('&');

        _.each(hashes, function(hash, i) {
            hash = hash.split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
        });

        return vars;
    },

    /*
    * _.cookie - gets a cookie in the request
    */

    cookie: function(name) {
        c = document.cookie.split('; ');
        cookies = {};

        for(i = c.length-1; i >= 0; i--){
           C = c[i].split('=');
           cookies[C[0]] = C[1];
        }

        return cookies[name];
    }
});

/* SCRIPTS.js */

/* create a noop implementation of window.console,
   so browsers that don't support it won't trip up */
if (!(window.console && console.log)) {
    console = {
        log: function(){},
        debug: function(){},
        info: function(){},
        warn: function(){},
        error: function(){}
    };
}

/*
* Main App
*/

var boiler = {
    app: Backbone.Events,

    /*
    * Backbone Models and Collections
    */

    models: {},
    collections: {},

    /*
    * Module System
    */

    module: function() {
        var modules = {};

        return function(name) {
            if (modules[name]) {
                return modules[name];
            }

            modules[name] = {};
            return modules[name];
        };
    }(),
    log: function(msg) {
        console.log(msg);
    },
    initialize: function() {
        var RouterModule = boiler.module('modules.router');

        /* App Router */
        boiler.router = new RouterModule.Router();

        /* Start HTML5 history support */
        Backbone.history.start({
            'hashChange': false,
            'root': '/'
        });
    }
};

$(document).ready(function() {
    return boiler.initialize();
});

$(document).on('page:load', function() {
  Backbone.history.stop();
  return boiler.initialize();
});

/* Core.js */

(function(module) {

    /*
    * Backbone.CollectionView
    */

    /* full list of options for all views */
    var view_options = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];
    var collection_view_options = ['model_class', 'view'];
    var all_options = view_options.concat(collection_view_options);


    var BaseView = Backbone.BaseView = Backbone.View.extend({
        transience: false,
        constructor: function(options) {
            Backbone.View.apply(this, arguments);

            this.initialize_(options);
        },
        initialize_: function(options) {
            /* if this view has been marked as transient */
            if (this.transience) {
                boiler.app.on('AppView:navigate', this.remove_);
            }
        },
        remove_: function() {
            /* actually remove the view */
            this.remove();

            /* trigger the close event so we can react to a view getting removed on navigation */
            this.trigger('remove');
        }
    });

    var CollectionView = Backbone.CollectionView = BaseView.extend({
        transcience: true,
        constructor: function(options) {
            this.views = [];

            Backbone.View.apply(this, arguments);

            this.initialize_(options);
            this.initial_events();
        },
        initialize_: function(options) {
            _.defaults(options, {
                'include_html': false,
                'include_class': '',
                'model_class': this.collection.model
            });

            /* Vars */
            _.extend(this, _.pick(options, collection_view_options));
            this.options = _.omit(options, all_options);

            /* Cached Elements */
            this.els = this.$el.children('li' + options.include_class);

            /* check to see if we're going to retrieve data from the DOM by checking
               for the existence of the data-id attribute on the first child */
            if (this.els.first().data('id')) {
                var models_array = [];
                _.each(this.els, function(el) {
                    var $el = $(el);

                    /* create the model for this element */
                    var model = this.model_class.find_or_create($el.data());
                    models_array.push(model);

                    /* implant the html if we specified that we need to */
                    if (this.options.include_html) {
                        model.set('html', $el.prop('outerHTML'));
                    }

                    /* mixin with the options we received for the collection */
                    var attrs = {
                        'el': el,
                        'model': model
                    };
                    var options = _.extend(attrs, this.options);
                    var view = new this.view(options);

                    /* add to our local array of views */
                    this.views.push(view);
                }, this);
                this.collection.reset(models_array);
            }
            else {
                /* pre-populate the collection with the current models */
                this.collection.each(function(model, i) {
                    var el = this.els[i];
                    var $el = $(el);

                    /* implant the html if we specified that we need to */
                    if (this.options.include_html && !model.has('html')) {
                        model.set('html', $el.prop('outerHTML'));
                    }

                    /* mixin with the options we received for the collection */
                    var attrs = {
                        'el': el,
                        'model': model
                    };
                    var options = _.extend(attrs, this.options);
                    var view = new this.view(options);

                    /* add to our local array of views */
                    this.views.push(view);
                }, this);
            }

            /* if this view is marked as transient */
            if (this.transience) {
                boiler.app.on('BaseView:close', this.close);
            }
        },
        initial_events: function() {
            /* Events */
            this.listenTo(this.collection, 'add', this.add_view);
            this.listenTo(this.collection, 'change:modified', this.edit_view);
            this.listenTo(this.collection, 'remove', this.remove_view);
            this.listenTo(this.collection, 'reset', this.add_all_views);
        },
        add_all_views: function(collection) {
            /* clear out the list element */
            this.$el.children('li' + this.options.include_class).remove();

            /* add all of the views to this list element */
            collection.each(this.add_view);
        },
        add_view: function(model) {
            var attrs = {
                'model': model,
                'el': model.get('html')
            };
            /* mixin with the options we received for the collection */
            var options = _.extend(attrs, this.options);
            var view = new this.view(options);

            /* find the index of the model in the collection, and also its
               previous index */
            var i = this.collection.indexOf(model);
            var prev_i = i - 1;

            /* put the view in our local array of views */
            this.views.splice(i, 0, view);

            /* refresh the elements */
            this.els = this.$el.children('li' + this.options.include_class);

            /* put the post at the correct location in the DOM */
            if (prev_i > -1) {
                $(this.els[prev_i]).after(view.el);
            }
            else {
                this.$el.prepend(view.el);
            }

            /* call the add event on the view itself */
            view.trigger('add');

            /* call the add_view event */
            this.trigger('add_view', view);
        },
        edit_view: function(model) {
            var attrs = {
                'model': model,
                'el': model.get('html')
            };
            /* mixin with the options we received for the collection */
            var options = _.extend(attrs, this.options);
            var view = new this.view(options);

            /* get the current view that we're replacing */
            var curr_view = this.get(model);

            /* replace the view in our array */
            var index = this.collection.indexOf(model);
            this.views[index] = view;

            /* replace the old view with the new one */
            curr_view.$el.replaceWith(view.el);

            /* trigger the edit event */
            this.trigger('edit_view', view);

            /* remove the current view */
            curr_view.remove();
        },
        remove_view: function(model) {
            _.every(this.views, function(view, index) {
                /* use cid b/c we won't always have the id for unsynced models */
                if (view.model.cid === model.cid) {
                    /* remove the view from the DOM */
                    view.remove();

                    /* remove from our list of views */
                    this.views.splice(index, 1);

                    /* call the remove event on the view itself */
                    view.trigger('remove');

                    /* call the add_view event */
                    this.trigger('remove_view', view);

                    return false;
                }

                /* _.every loop breaks on false, so to counter the offset model id, return true in else fork */
                return true;
            }, this);
        },

        /*
        * Utility
        */

        get: function(model) {
            return _.find(this.views, function(view, index) {
                /* use cid b/c we won't always have the id for unsynced models */
                if (view.model.cid === model.cid) {
                    return true;
                }
                return false;
            }, this);
        }
    });

    /*
    * Backbone.ModelView
    */

    var ModelView = Backbone.ModelView = BaseView.extend({
        transcience: true,
        constructor: function() {
            Backbone.View.apply(this, arguments);
        }
    });

})(boiler.module('modules.core'));

/* Router */

(function(module) {

    /*
    * Dependencies
    */

    var AppViews = boiler.module('views.app');
    var PageViews = boiler.module('views.page');

    /*
    * Custom Router
    */

    module.BoilerRouter = Backbone.Router.extend({
        force_navigate: function(fragment, options) {
            /* default to the current url fragment if it's not passed in */
            fragment = fragment || window.location.pathname.slice(1);

            /* load the url through the router to run the page-specific logic */
            Backbone.history.loadUrl(fragment);
        }
    });

    /*
    * Router for main app
    */

    module.Router = module.BoilerRouter.extend({
        initialize: function() {
            _.bindObj(this);

            /* Cached Elements */
            this.document_el = $(document);
            this.body_el = this.document_el.find('.js-body');

            /* create the central app view */
            this.app_view = new AppViews.AppView({
                'el': this.body_el
            });
        }
    });

})(boiler.module('modules.router'));

/* APP VIEW */

(function(module) {

    /*
    * Dependencies
    */

    var PageViews = boiler.module('views.page');

    /*
    * Views
    */

    module.AppView = Backbone.BaseView.extend({
        initialize: function() {
            _.bindObj(this);

            /* Vars */
            this.original_title = document.title;

            /* Cached Elements */
            this.navbar_el = this.$el.find('.js-navbar');

            /* Subviews */
            this.navbar_view = new PageViews.NavbarView({
                'el': this.navbar_el
            });
        }
    });

})(boiler.module('views.app'));

/* Page Views */

(function(module) {

    /*
    * Views
    */

    module.NavbarView = Backbone.BaseView.extend({
        initialize: function() {
            _.bindObj(this);
        }
    });

    module.PageView = Backbone.BaseView.extend({
        initialize: function() {
            _.bindObj(this);

            /* Cached Elements */
        }
    });

})(boiler.module('views.page'));
