/*
 * Copyright 2012 Adobe Systems Incorporated. All Rights Reserved.
 * @author Jonathan Diehl <jdiehl@adobe.com>
 */

/*jslint vars: true, plusplus: true, devel: true, browser: true, nomen: true, indent: 4, forin: true, maxerr: 50, regexp: true */
/*global define, $ */

/**
 * CSSDocument manages a single CSS source document
 *
 * # EDITING
 *
 * Editing the document will cause the style sheet to be reloaded via the
 * CSSAgent, which immediately updates the appearance of the rendered document.
 *
 * # HIGHLIGHTING
 *
 * CSSDocument supports highlighting nodes from the HighlightAgent and
 * highlighting all DOMNode corresponding to the rule at the cursor position
 * in the editor.
 */
define(function CSSDocumentModule(require, exports, module) {
    'use strict';

    var Inspector = require("LiveDevelopment/Inspector/Inspector");
    var CSSAgent = require("LiveDevelopment/Agents/CSSAgent");
    var HighlightAgent = require("LiveDevelopment/Agents/HighlightAgent");

    /** Constructor
     *
     * @param Document the source document from Brackets
     */
    var CSSDocument = function CSSDocument(doc, editor, inspector) {
        this.doc = doc;
        this.editor = editor;
        this._highlight = [];
        this.onHighlight = this.onHighlight.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onCursorActivity = this.onCursorActivity.bind(this);
        Inspector.on("HighlightAgent.highlight", this.onHighlight);
        $(this.editor).on("change", this.onChange);
        $(this.editor).on("cursorActivity", this.onCursorActivity);
        this.onCursorActivity();

        // get the style sheet
        this.styleSheet = CSSAgent.styleForURL(this.doc.url);

        // WebInspector Command: CSS.getStyleSheet
        Inspector.CSS.getStyleSheet(this.styleSheet.styleSheetId, function callback(res) {
            // res = {styleSheet}
            this.rules = res.styleSheet.rules;
        }.bind(this));
    };

    /** Close the document */
    CSSDocument.prototype.close = function close() {
        Inspector.off("HighlightAgent.highlight", this.onHighlight);
        $(this.editor).off("change", this.onChange);
        $(this.editor).off("cursorActivity", this.onCursorActivity);
        this.onHighlight();
    };

    // find a rule in the given rules
    CSSDocument.prototype.ruleAtLocation = function ruleAtLocation(location) {
        var i, rule;
        for (i in this.rules) {
            rule = this.rules[i];
            if (rule.selectorRange.start <= location && location <= rule.style.range.end) {
                return rule;
            }
        }
        return null;
    };


    /** Event Handlers *******************************************************/

    /** Triggered on cursor activity of the editor */
    CSSDocument.prototype.onCursorActivity = function onCursorActivity(event, editor) {
        if (Inspector.config.highlight) {
            var codeMirror = this.editor._codeMirror;
            var location = codeMirror.indexFromPos(codeMirror.getCursor());
            var rule = this.ruleAtLocation(location);
            if (rule) {
                HighlightAgent.rule(rule.selectorText);
            } else {
                HighlightAgent.hide();
            }
        }
    };

    /** Triggered on change of the editor */
    CSSDocument.prototype.onChange = function onChange(event, editor, change) {
        // brute force: update the CSS
        CSSAgent.reloadDocument(this.doc);
    };

    /** Triggered by the HighlightAgent to highlight a node in the editor */
    CSSDocument.prototype.onHighlight = function onHighlight(node) {
        // clear an existing highlight
        var i;
        for (i in this._highlight) {
            this._highlight[i].clear();
        }
        this._highlight = [];
        if (!node || !node.location) {
            return;
        }

        // WebInspector Command: CSS.getMatchedStylesForNode
        Inspector.CSS.getMatchedStylesForNode(node.nodeId, function onGetMatchesStyles(res) {
            // res = {matchedCSSRules, pseudoElements, inherited}
            var codeMirror = this.editor._codeMirror;
            var i, rule, from, to;
            for (i in res.matchedCSSRules) {
                rule = res.matchedCSSRules[i];
                if (rule.ruleId && rule.ruleId.styleSheetId === this.styleSheet.styleSheetId) {
                    from = codeMirror.posFromIndex(rule.selectorRange.start);
                    to = codeMirror.posFromIndex(rule.style.range.end);
                    this._highlight.push(codeMirror.markText(from, to, "highlight"));
                }
            }
        }.bind(this));
    };

    // Export the class
    module.exports = CSSDocument;
});