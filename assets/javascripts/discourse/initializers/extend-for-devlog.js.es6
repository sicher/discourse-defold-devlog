import Quote from 'discourse/lib/quote';
import Composer from 'discourse/models/composer';
import Post from 'discourse/models/post';
import property from 'ember-addons/ember-computed-decorators';
import { ajax } from 'discourse/lib/ajax';
import { popupAjaxError } from 'discourse/lib/ajax-error';
import { withPluginApi } from 'discourse/lib/plugin-api';

function initializeDevlog(api) {

  api.includePostAttributes('devlog_post');

  // This is for testing purposes.
  api.decorateWidget('post:after', function (dec) {
    var post = dec.getModel();
    return `[devlog ${post.devlog_post}]`;
  });

  api.modifyClass('model:composer', {

    devlog_posting: function() {
      if(this.get('devlogPosting') == 'post') {
        return '<h2>New devlog post</h2>';
      }
    }.property('devlogPosting'),

    save(opts) {
      // ---- Replicating logic from composer
      if (this.get('cantSubmitPost')) {
        return;
      }
      // ---- Replicating logic from composer
      if (!this.get('canEditTopicFeaturedLink')) {
        this.set('featuredLink', null);
      }
      // ---- Replicating logic from composer
      if (this.get('editingPost')) {
        return this.editPost(opts);
      }

      // Specific stuff for devlog
      const devlogPosting = this.get('devlogPosting');
      const postStream = this.get("topic.postStream");

      const applydevlog = function (res) {
        // If this is the first post in a devlog category topic, or
        // if devlogPosting is "post", try making this a post, otherwise
        // try making it a reply.
        var method = "tryreply";
        if (res.responseJson.post.post_number == 1 || devlogPosting == "post") {
          method = "trypost";
        }
        const topic_id = res.responseJson.post.topic_id;
        const post_id = res.responseJson.post.id;

        var rebake = function () {};
        if (postStream) {
          const post = postStream.findLoadedPost(post_id);
          rebake = () => post.rebake();
        }

        ajax(`/devlog-post/${topic_id}/${post_id}/${method}`, { type: "PUT" })
          .then(rebake)
          .catch(popupAjaxError);
        return res;
      };
      return this.createPost(opts).then(applydevlog);
    }
  });

  api.modifyClass('controller:topic', {

    updateDevlog(post, method) {
      const rebake = () => post.rebake();
      const post_id = post.get("id");
      const topic_id = post.get("topic_id");
      return ajax(`/devlog-post/${topic_id}/${post_id}/${method}`, { type: "PUT" })
        .then(rebake)
        .catch(popupAjaxError);
    },

    actions: {
      replyToPost(post) {
        this._super(post);
        const composerController = this.get('composer');
        composerController.set('model.devlogPosting', 'reply');
      },

      postDevlog(post) {
        this.actions.replyToPost.call(this, post);
        const composerController = this.get('composer');
        composerController.set('model.devlogPosting', 'post');
        return false;
      },

      setDevlogPost(post) {
        return this.updateDevlog(post, "trypost");
      },

      setDevlogReply(post) {
        return this.updateDevlog(post, "tryreply");
      }
    }
  });

};

export default {
  name: "extend-for-devlog",

  initialize() {
    withPluginApi('0.8.15', initializeDevlog);
  }
};