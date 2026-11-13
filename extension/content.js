(() => {
  // src/content/adapters.js
  var ROLE = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width >= 120 && r.height >= 120 && getComputedStyle(el).visibility !== "hidden";
  }
  function squareAt(rect, cx, cy, orientation) {
    const col = Math.floor((cx - rect.left) / rect.width * 8);
    const row = Math.floor((cy - rect.top) / rect.height * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
    const file2 = orientation === "white" ? col : 7 - col;
    const rank2 = orientation === "white" ? 7 - row : row;
    return rank2 * 8 + file2;
  }
  var centerSquare = (el, rect, orientation) => {
    const r = el.getBoundingClientRect();
    return squareAt(rect, r.left + r.width / 2, r.top + r.height / 2, orientation);
  };
  var lichess = {
    id: "lichess",
    name: "Lichess",
    matches: () => location.hostname.endsWith("lichess.org"),
    findBoards: () => [...document.querySelectorAll("cg-board")].filter(isVisible),
    orientation(el) {
      const wrap = el.closest(".cg-wrap");
      if (wrap && wrap.classList.contains("orientation-black")) return "black";
      if (wrap && wrap.classList.contains("orientation-white")) return "white";
      return wrap && wrap.querySelector("coords.ranks.black") ? "black" : "white";
    },
    read(el) {
      if (el.querySelector("piece.dragging")) return { dragging: true };
      const orientation = this.orientation(el);
      const rect = el.getBoundingClientRect();
      const board = new Array(64).fill(null);
      for (const piece of el.querySelectorAll("piece")) {
        if (piece.classList.contains("ghost") || piece.classList.contains("fading")) continue;
        const color = piece.classList.contains("white") ? "white" : piece.classList.contains("black") ? "black" : null;
        const role = Object.keys(ROLE).find((r) => piece.classList.contains(r));
        if (!color || !role) continue;
        const idx = centerSquare(piece, rect, orientation);
        if (idx < 0) continue;
        board[idx] = color === "white" ? ROLE[role].toUpperCase() : ROLE[role];
      }
      const last = [...el.querySelectorAll("square.last-move")].map((s) => centerSquare(s, rect, orientation)).filter((i) => i >= 0);
      let clockTurn;
      const running = document.querySelector(".rclock.running");
      if (running) {
        const bottomIsWhite = orientation === "white";
        const isBottom = running.classList.contains("rclock-bottom");
        clockTurn = isBottom === bottomIsWhite ? "w" : "b";
      }
      return { board, orientation, lastMove: last.length === 2 ? last : null, dragging: false, clockTurn };
    }
  };
  var chesscom = {
    id: "chesscom",
    name: "Chess.com",
    matches: () => location.hostname.endsWith("chess.com"),
    findBoards: () => [...document.querySelectorAll("wc-chess-board, chess-board")].filter(
      (el) => isVisible(el) && el.querySelector(".piece")
    ),
    read(el) {
      if (el.querySelector(".piece.dragging")) return { dragging: true };
      const orientation = el.classList.contains("flipped") ? "black" : "white";
      const board = new Array(64).fill(null);
      for (const piece of el.querySelectorAll(".piece")) {
        const m = piece.className.match(/(?:^|\s)([wb])([pnbrqk])(?:\s|$)/);
        const sq = piece.className.match(/square-(\d)(\d)/);
        if (!m || !sq) continue;
        const file2 = +sq[1] - 1;
        const rank2 = +sq[2] - 1;
        if (file2 < 0 || file2 > 7 || rank2 < 0 || rank2 > 7) continue;
        board[rank2 * 8 + file2] = m[1] === "w" ? m[2].toUpperCase() : m[2];
      }
      const last = [...el.querySelectorAll(".highlight")].map((h) => h.className.match(/square-(\d)(\d)/)).filter(Boolean).map((m) => (+m[2] - 1) * 8 + (+m[1] - 1));
      return { board, orientation, lastMove: last.length === 2 ? last : null, dragging: false };
    }
  };
  var adapters = [lichess, chesscom].filter((a) => a.matches());
  function pickBoard() {
    let best = null;
    for (const adapter of adapters) {
      for (const el of adapter.findBoards()) {
        const r = el.getBoundingClientRect();
        const area = r.width * r.height;
        if (!best || area > best.area) best = { adapter, el, area };
      }
    }
    return best;
  }

  // node_modules/chess.js/dist/esm/chess.js
  function rootNode(comment) {
    return comment !== null ? { comment, variations: [] } : { variations: [] };
  }
  function node(move2, suffix, nag, comment, variations) {
    const node2 = { move: move2, variations };
    if (suffix) {
      node2.suffix = suffix;
    }
    if (nag) {
      node2.nag = nag;
    }
    if (comment !== null) {
      node2.comment = comment;
    }
    return node2;
  }
  function lineToTree(...nodes) {
    const [root, ...rest] = nodes;
    let parent = root;
    for (const child of rest) {
      if (child !== null) {
        parent.variations = [child, ...child.variations];
        child.variations = [];
        parent = child;
      }
    }
    return root;
  }
  function pgn(headers, game) {
    if (game.marker && game.marker.comment) {
      let node2 = game.root;
      while (true) {
        const next = node2.variations[0];
        if (!next) {
          node2.comment = game.marker.comment;
          break;
        }
        node2 = next;
      }
    }
    return {
      headers,
      root: game.root,
      result: (game.marker && game.marker.result) ?? void 0
    };
  }
  function peg$subclass(child, parent) {
    function C() {
      this.constructor = child;
    }
    C.prototype = parent.prototype;
    child.prototype = new C();
  }
  function peg$SyntaxError(message, expected, found, location2) {
    var self = Error.call(this, message);
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(self, peg$SyntaxError.prototype);
    }
    self.expected = expected;
    self.found = found;
    self.location = location2;
    self.name = "SyntaxError";
    return self;
  }
  peg$subclass(peg$SyntaxError, Error);
  function peg$padEnd(str, targetLength, padString) {
    padString = padString || " ";
    if (str.length > targetLength) {
      return str;
    }
    targetLength -= str.length;
    padString += padString.repeat(targetLength);
    return str + padString.slice(0, targetLength);
  }
  peg$SyntaxError.prototype.format = function(sources) {
    var str = "Error: " + this.message;
    if (this.location) {
      var src = null;
      var k;
      for (k = 0; k < sources.length; k++) {
        if (sources[k].source === this.location.source) {
          src = sources[k].text.split(/\r\n|\n|\r/g);
          break;
        }
      }
      var s = this.location.start;
      var offset_s = this.location.source && typeof this.location.source.offset === "function" ? this.location.source.offset(s) : s;
      var loc = this.location.source + ":" + offset_s.line + ":" + offset_s.column;
      if (src) {
        var e = this.location.end;
        var filler = peg$padEnd("", offset_s.line.toString().length, " ");
        var line = src[s.line - 1];
        var last = s.line === e.line ? e.column : line.length + 1;
        var hatLen = last - s.column || 1;
        str += "\n --> " + loc + "\n" + filler + " |\n" + offset_s.line + " | " + line + "\n" + filler + " | " + peg$padEnd("", s.column - 1, " ") + peg$padEnd("", hatLen, "^");
      } else {
        str += "\n at " + loc;
      }
    }
    return str;
  };
  peg$SyntaxError.buildMessage = function(expected, found) {
    var DESCRIBE_EXPECTATION_FNS = {
      literal: function(expectation) {
        return '"' + literalEscape(expectation.text) + '"';
      },
      class: function(expectation) {
        var escapedParts = expectation.parts.map(function(part) {
          return Array.isArray(part) ? classEscape(part[0]) + "-" + classEscape(part[1]) : classEscape(part);
        });
        return "[" + (expectation.inverted ? "^" : "") + escapedParts.join("") + "]";
      },
      any: function() {
        return "any character";
      },
      end: function() {
        return "end of input";
      },
      other: function(expectation) {
        return expectation.description;
      }
    };
    function hex(ch) {
      return ch.charCodeAt(0).toString(16).toUpperCase();
    }
    function literalEscape(s) {
      return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
        return "\\x0" + hex(ch);
      }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
        return "\\x" + hex(ch);
      });
    }
    function classEscape(s) {
      return s.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/-/g, "\\-").replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
        return "\\x0" + hex(ch);
      }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
        return "\\x" + hex(ch);
      });
    }
    function describeExpectation(expectation) {
      return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
    }
    function describeExpected(expected2) {
      var descriptions = expected2.map(describeExpectation);
      var i, j;
      descriptions.sort();
      if (descriptions.length > 0) {
        for (i = 1, j = 1; i < descriptions.length; i++) {
          if (descriptions[i - 1] !== descriptions[i]) {
            descriptions[j] = descriptions[i];
            j++;
          }
        }
        descriptions.length = j;
      }
      switch (descriptions.length) {
        case 1:
          return descriptions[0];
        case 2:
          return descriptions[0] + " or " + descriptions[1];
        default:
          return descriptions.slice(0, -1).join(", ") + ", or " + descriptions[descriptions.length - 1];
      }
    }
    function describeFound(found2) {
      return found2 ? '"' + literalEscape(found2) + '"' : "end of input";
    }
    return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
  };
  function peg$parse(input, options) {
    options = options !== void 0 ? options : {};
    var peg$FAILED = {};
    var peg$source = options.grammarSource;
    var peg$startRuleFunctions = { pgn: peg$parsepgn };
    var peg$startRuleFunction = peg$parsepgn;
    var peg$c0 = "[";
    var peg$c1 = '"';
    var peg$c2 = "]";
    var peg$c3 = ".";
    var peg$c4 = "O-O-O";
    var peg$c5 = "O-O";
    var peg$c6 = "0-0-0";
    var peg$c7 = "0-0";
    var peg$c8 = "$";
    var peg$c9 = "{";
    var peg$c10 = "}";
    var peg$c11 = ";";
    var peg$c12 = "(";
    var peg$c13 = ")";
    var peg$c14 = "1-0";
    var peg$c15 = "0-1";
    var peg$c16 = "1/2-1/2";
    var peg$c17 = "*";
    var peg$r0 = /^[a-zA-Z]/;
    var peg$r1 = /^[^"]/;
    var peg$r2 = /^[0-9]/;
    var peg$r3 = /^[.]/;
    var peg$r4 = /^[a-zA-Z1-8\-=]/;
    var peg$r5 = /^[+#]/;
    var peg$r6 = /^[!?]/;
    var peg$r7 = /^[^}]/;
    var peg$r8 = /^[^\r\n]/;
    var peg$r9 = /^[ \t\r\n]/;
    var peg$e0 = peg$otherExpectation("tag pair");
    var peg$e1 = peg$literalExpectation("[", false);
    var peg$e2 = peg$literalExpectation('"', false);
    var peg$e3 = peg$literalExpectation("]", false);
    var peg$e4 = peg$otherExpectation("tag name");
    var peg$e5 = peg$classExpectation([["a", "z"], ["A", "Z"]], false, false);
    var peg$e6 = peg$otherExpectation("tag value");
    var peg$e7 = peg$classExpectation(['"'], true, false);
    var peg$e8 = peg$otherExpectation("move number");
    var peg$e9 = peg$classExpectation([["0", "9"]], false, false);
    var peg$e10 = peg$literalExpectation(".", false);
    var peg$e11 = peg$classExpectation(["."], false, false);
    var peg$e12 = peg$otherExpectation("standard algebraic notation");
    var peg$e13 = peg$literalExpectation("O-O-O", false);
    var peg$e14 = peg$literalExpectation("O-O", false);
    var peg$e15 = peg$literalExpectation("0-0-0", false);
    var peg$e16 = peg$literalExpectation("0-0", false);
    var peg$e17 = peg$classExpectation([["a", "z"], ["A", "Z"], ["1", "8"], "-", "="], false, false);
    var peg$e18 = peg$classExpectation(["+", "#"], false, false);
    var peg$e19 = peg$otherExpectation("suffix annotation");
    var peg$e20 = peg$classExpectation(["!", "?"], false, false);
    var peg$e21 = peg$otherExpectation("NAG");
    var peg$e22 = peg$literalExpectation("$", false);
    var peg$e23 = peg$otherExpectation("brace comment");
    var peg$e24 = peg$literalExpectation("{", false);
    var peg$e25 = peg$classExpectation(["}"], true, false);
    var peg$e26 = peg$literalExpectation("}", false);
    var peg$e27 = peg$otherExpectation("rest of line comment");
    var peg$e28 = peg$literalExpectation(";", false);
    var peg$e29 = peg$classExpectation(["\r", "\n"], true, false);
    var peg$e30 = peg$otherExpectation("variation");
    var peg$e31 = peg$literalExpectation("(", false);
    var peg$e32 = peg$literalExpectation(")", false);
    var peg$e33 = peg$otherExpectation("game termination marker");
    var peg$e34 = peg$literalExpectation("1-0", false);
    var peg$e35 = peg$literalExpectation("0-1", false);
    var peg$e36 = peg$literalExpectation("1/2-1/2", false);
    var peg$e37 = peg$literalExpectation("*", false);
    var peg$e38 = peg$otherExpectation("whitespace");
    var peg$e39 = peg$classExpectation([" ", "	", "\r", "\n"], false, false);
    var peg$f0 = function(headers, game) {
      return pgn(headers, game);
    };
    var peg$f1 = function(tagPairs) {
      return Object.fromEntries(tagPairs);
    };
    var peg$f2 = function(tagName, tagValue) {
      return [tagName, tagValue];
    };
    var peg$f3 = function(root, marker) {
      return { root, marker };
    };
    var peg$f4 = function(comment, moves) {
      return lineToTree(rootNode(comment), ...moves.flat());
    };
    var peg$f5 = function(san, suffix, nag, comment, variations) {
      return node(san, suffix, nag, comment, variations);
    };
    var peg$f6 = function(nag) {
      return nag;
    };
    var peg$f7 = function(comment) {
      return comment.replace(/[\r\n]+/g, " ");
    };
    var peg$f8 = function(comment) {
      return comment.trim();
    };
    var peg$f9 = function(line) {
      return line;
    };
    var peg$f10 = function(result, comment) {
      return { result, comment };
    };
    var peg$currPos = options.peg$currPos | 0;
    var peg$posDetailsCache = [{ line: 1, column: 1 }];
    var peg$maxFailPos = peg$currPos;
    var peg$maxFailExpected = options.peg$maxFailExpected || [];
    var peg$silentFails = options.peg$silentFails | 0;
    var peg$result;
    if (options.startRule) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error(`Can't start parsing from rule "` + options.startRule + '".');
      }
      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }
    function peg$literalExpectation(text, ignoreCase) {
      return { type: "literal", text, ignoreCase };
    }
    function peg$classExpectation(parts, inverted, ignoreCase) {
      return { type: "class", parts, inverted, ignoreCase };
    }
    function peg$endExpectation() {
      return { type: "end" };
    }
    function peg$otherExpectation(description) {
      return { type: "other", description };
    }
    function peg$computePosDetails(pos) {
      var details = peg$posDetailsCache[pos];
      var p;
      if (details) {
        return details;
      } else {
        if (pos >= peg$posDetailsCache.length) {
          p = peg$posDetailsCache.length - 1;
        } else {
          p = pos;
          while (!peg$posDetailsCache[--p]) {
          }
        }
        details = peg$posDetailsCache[p];
        details = {
          line: details.line,
          column: details.column
        };
        while (p < pos) {
          if (input.charCodeAt(p) === 10) {
            details.line++;
            details.column = 1;
          } else {
            details.column++;
          }
          p++;
        }
        peg$posDetailsCache[pos] = details;
        return details;
      }
    }
    function peg$computeLocation(startPos, endPos, offset) {
      var startPosDetails = peg$computePosDetails(startPos);
      var endPosDetails = peg$computePosDetails(endPos);
      var res = {
        source: peg$source,
        start: {
          offset: startPos,
          line: startPosDetails.line,
          column: startPosDetails.column
        },
        end: {
          offset: endPos,
          line: endPosDetails.line,
          column: endPosDetails.column
        }
      };
      return res;
    }
    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) {
        return;
      }
      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }
      peg$maxFailExpected.push(expected);
    }
    function peg$buildStructuredError(expected, found, location2) {
      return new peg$SyntaxError(
        peg$SyntaxError.buildMessage(expected, found),
        expected,
        found,
        location2
      );
    }
    function peg$parsepgn() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = peg$parsetagPairSection();
      s2 = peg$parsemoveTextSection();
      s0 = peg$f0(s1, s2);
      return s0;
    }
    function peg$parsetagPairSection() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parsetagPair();
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parsetagPair();
      }
      s2 = peg$parse_();
      s0 = peg$f1(s1);
      return s0;
    }
    function peg$parsetagPair() {
      var s0, s2, s4, s6, s7, s8, s10;
      peg$silentFails++;
      s0 = peg$currPos;
      peg$parse_();
      if (input.charCodeAt(peg$currPos) === 91) {
        s2 = peg$c0;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e1);
        }
      }
      if (s2 !== peg$FAILED) {
        peg$parse_();
        s4 = peg$parsetagName();
        if (s4 !== peg$FAILED) {
          peg$parse_();
          if (input.charCodeAt(peg$currPos) === 34) {
            s6 = peg$c1;
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e2);
            }
          }
          if (s6 !== peg$FAILED) {
            s7 = peg$parsetagValue();
            if (input.charCodeAt(peg$currPos) === 34) {
              s8 = peg$c1;
              peg$currPos++;
            } else {
              s8 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e2);
              }
            }
            if (s8 !== peg$FAILED) {
              peg$parse_();
              if (input.charCodeAt(peg$currPos) === 93) {
                s10 = peg$c2;
                peg$currPos++;
              } else {
                s10 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e3);
                }
              }
              if (s10 !== peg$FAILED) {
                s0 = peg$f2(s4, s7);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) {
          peg$fail(peg$e0);
        }
      }
      return s0;
    }
    function peg$parsetagName() {
      var s0, s1, s2;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = input.charAt(peg$currPos);
      if (peg$r0.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e5);
        }
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = input.charAt(peg$currPos);
          if (peg$r0.test(s2)) {
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e5);
            }
          }
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        s0 = input.substring(s0, peg$currPos);
      } else {
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e4);
        }
      }
      return s0;
    }
    function peg$parsetagValue() {
      var s0, s1, s2;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = input.charAt(peg$currPos);
      if (peg$r1.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e7);
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = input.charAt(peg$currPos);
        if (peg$r1.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e7);
          }
        }
      }
      s0 = input.substring(s0, peg$currPos);
      peg$silentFails--;
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e6);
      }
      return s0;
    }
    function peg$parsemoveTextSection() {
      var s0, s1, s3;
      s0 = peg$currPos;
      s1 = peg$parseline();
      peg$parse_();
      s3 = peg$parsegameTerminationMarker();
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      peg$parse_();
      s0 = peg$f3(s1, s3);
      return s0;
    }
    function peg$parseline() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      s1 = peg$parsecomment();
      if (s1 === peg$FAILED) {
        s1 = null;
      }
      s2 = [];
      s3 = peg$parsemove();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parsemove();
      }
      s0 = peg$f4(s1, s2);
      return s0;
    }
    function peg$parsemove() {
      var s0, s4, s5, s6, s7, s8, s9, s10;
      s0 = peg$currPos;
      peg$parse_();
      peg$parsemoveNumber();
      peg$parse_();
      s4 = peg$parsesan();
      if (s4 !== peg$FAILED) {
        s5 = peg$parsesuffixAnnotation();
        if (s5 === peg$FAILED) {
          s5 = null;
        }
        s6 = [];
        s7 = peg$parsenag();
        while (s7 !== peg$FAILED) {
          s6.push(s7);
          s7 = peg$parsenag();
        }
        s7 = peg$parse_();
        s8 = peg$parsecomment();
        if (s8 === peg$FAILED) {
          s8 = null;
        }
        s9 = [];
        s10 = peg$parsevariation();
        while (s10 !== peg$FAILED) {
          s9.push(s10);
          s10 = peg$parsevariation();
        }
        s0 = peg$f5(s4, s5, s6, s8, s9);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      return s0;
    }
    function peg$parsemoveNumber() {
      var s0, s1, s2, s3, s4, s5;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = input.charAt(peg$currPos);
      if (peg$r2.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e9);
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = input.charAt(peg$currPos);
        if (peg$r2.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e9);
          }
        }
      }
      if (input.charCodeAt(peg$currPos) === 46) {
        s2 = peg$c3;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e10);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        s4 = [];
        s5 = input.charAt(peg$currPos);
        if (peg$r3.test(s5)) {
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e11);
          }
        }
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = input.charAt(peg$currPos);
          if (peg$r3.test(s5)) {
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e11);
            }
          }
        }
        s1 = [s1, s2, s3, s4];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e8);
        }
      }
      return s0;
    }
    function peg$parsesan() {
      var s0, s1, s2, s3, s4, s5;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$currPos;
      if (input.substr(peg$currPos, 5) === peg$c4) {
        s2 = peg$c4;
        peg$currPos += 5;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e13);
        }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c5) {
          s2 = peg$c5;
          peg$currPos += 3;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e14);
          }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 5) === peg$c6) {
            s2 = peg$c6;
            peg$currPos += 5;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e15);
            }
          }
          if (s2 === peg$FAILED) {
            if (input.substr(peg$currPos, 3) === peg$c7) {
              s2 = peg$c7;
              peg$currPos += 3;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e16);
              }
            }
            if (s2 === peg$FAILED) {
              s2 = peg$currPos;
              s3 = input.charAt(peg$currPos);
              if (peg$r0.test(s3)) {
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e5);
                }
              }
              if (s3 !== peg$FAILED) {
                s4 = [];
                s5 = input.charAt(peg$currPos);
                if (peg$r4.test(s5)) {
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$e17);
                  }
                }
                if (s5 !== peg$FAILED) {
                  while (s5 !== peg$FAILED) {
                    s4.push(s5);
                    s5 = input.charAt(peg$currPos);
                    if (peg$r4.test(s5)) {
                      peg$currPos++;
                    } else {
                      s5 = peg$FAILED;
                      if (peg$silentFails === 0) {
                        peg$fail(peg$e17);
                      }
                    }
                  }
                } else {
                  s4 = peg$FAILED;
                }
                if (s4 !== peg$FAILED) {
                  s3 = [s3, s4];
                  s2 = s3;
                } else {
                  peg$currPos = s2;
                  s2 = peg$FAILED;
                }
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = input.charAt(peg$currPos);
        if (peg$r5.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e18);
          }
        }
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        s2 = [s2, s3];
        s1 = s2;
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        s0 = input.substring(s0, peg$currPos);
      } else {
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e12);
        }
      }
      return s0;
    }
    function peg$parsesuffixAnnotation() {
      var s0, s1, s2;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = input.charAt(peg$currPos);
      if (peg$r6.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e20);
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        if (s1.length >= 2) {
          s2 = peg$FAILED;
        } else {
          s2 = input.charAt(peg$currPos);
          if (peg$r6.test(s2)) {
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e20);
            }
          }
        }
      }
      if (s1.length < 1) {
        peg$currPos = s0;
        s0 = peg$FAILED;
      } else {
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e19);
        }
      }
      return s0;
    }
    function peg$parsenag() {
      var s0, s2, s3, s4, s5;
      peg$silentFails++;
      s0 = peg$currPos;
      peg$parse_();
      if (input.charCodeAt(peg$currPos) === 36) {
        s2 = peg$c8;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e22);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        s4 = [];
        s5 = input.charAt(peg$currPos);
        if (peg$r2.test(s5)) {
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e9);
          }
        }
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = input.charAt(peg$currPos);
            if (peg$r2.test(s5)) {
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e9);
              }
            }
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s3 = input.substring(s3, peg$currPos);
        } else {
          s3 = s4;
        }
        if (s3 !== peg$FAILED) {
          s0 = peg$f6(s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) {
          peg$fail(peg$e21);
        }
      }
      return s0;
    }
    function peg$parsecomment() {
      var s0;
      s0 = peg$parsebraceComment();
      if (s0 === peg$FAILED) {
        s0 = peg$parserestOfLineComment();
      }
      return s0;
    }
    function peg$parsebraceComment() {
      var s0, s1, s2, s3, s4;
      peg$silentFails++;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 123) {
        s1 = peg$c9;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e24);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        s3 = [];
        s4 = input.charAt(peg$currPos);
        if (peg$r7.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e25);
          }
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = input.charAt(peg$currPos);
          if (peg$r7.test(s4)) {
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e25);
            }
          }
        }
        s2 = input.substring(s2, peg$currPos);
        if (input.charCodeAt(peg$currPos) === 125) {
          s3 = peg$c10;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e26);
          }
        }
        if (s3 !== peg$FAILED) {
          s0 = peg$f7(s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e23);
        }
      }
      return s0;
    }
    function peg$parserestOfLineComment() {
      var s0, s1, s2, s3, s4;
      peg$silentFails++;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 59) {
        s1 = peg$c11;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e28);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        s3 = [];
        s4 = input.charAt(peg$currPos);
        if (peg$r8.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e29);
          }
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = input.charAt(peg$currPos);
          if (peg$r8.test(s4)) {
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e29);
            }
          }
        }
        s2 = input.substring(s2, peg$currPos);
        s0 = peg$f8(s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e27);
        }
      }
      return s0;
    }
    function peg$parsevariation() {
      var s0, s2, s3, s5;
      peg$silentFails++;
      s0 = peg$currPos;
      peg$parse_();
      if (input.charCodeAt(peg$currPos) === 40) {
        s2 = peg$c12;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e31);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseline();
        if (s3 !== peg$FAILED) {
          peg$parse_();
          if (input.charCodeAt(peg$currPos) === 41) {
            s5 = peg$c13;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e32);
            }
          }
          if (s5 !== peg$FAILED) {
            s0 = peg$f9(s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) {
          peg$fail(peg$e30);
        }
      }
      return s0;
    }
    function peg$parsegameTerminationMarker() {
      var s0, s1, s3;
      peg$silentFails++;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c14) {
        s1 = peg$c14;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e34);
        }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c15) {
          s1 = peg$c15;
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e35);
          }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 7) === peg$c16) {
            s1 = peg$c16;
            peg$currPos += 7;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e36);
            }
          }
          if (s1 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 42) {
              s1 = peg$c17;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e37);
              }
            }
          }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$parse_();
        s3 = peg$parsecomment();
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        s0 = peg$f10(s1, s3);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e33);
        }
      }
      return s0;
    }
    function peg$parse_() {
      var s0, s1;
      peg$silentFails++;
      s0 = [];
      s1 = input.charAt(peg$currPos);
      if (peg$r9.test(s1)) {
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e39);
        }
      }
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = input.charAt(peg$currPos);
        if (peg$r9.test(s1)) {
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e39);
          }
        }
      }
      peg$silentFails--;
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e38);
      }
      return s0;
    }
    peg$result = peg$startRuleFunction();
    if (options.peg$library) {
      return (
        /** @type {any} */
        {
          peg$result,
          peg$currPos,
          peg$FAILED,
          peg$maxFailExpected,
          peg$maxFailPos
        }
      );
    }
    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail(peg$endExpectation());
      }
      throw peg$buildStructuredError(
        peg$maxFailExpected,
        peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
        peg$maxFailPos < input.length ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1) : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
      );
    }
  }
  var MASK64 = 0xffffffffffffffffn;
  function rotl(x, k) {
    return (x << k | x >> 64n - k) & 0xffffffffffffffffn;
  }
  function wrappingMul(x, y) {
    return x * y & MASK64;
  }
  function xoroshiro128(state) {
    return function() {
      let s0 = BigInt(state & MASK64);
      let s1 = BigInt(state >> 64n & MASK64);
      const result = wrappingMul(rotl(wrappingMul(s0, 5n), 7n), 9n);
      s1 ^= s0;
      s0 = (rotl(s0, 24n) ^ s1 ^ s1 << 16n) & MASK64;
      s1 = rotl(s1, 37n);
      state = s1 << 64n | s0;
      return result;
    };
  }
  var rand = xoroshiro128(0xa187eb39cdcaed8f31c4b365b102e01en);
  var PIECE_KEYS = Array.from({ length: 2 }, () => Array.from({ length: 6 }, () => Array.from({ length: 128 }, () => rand())));
  var EP_KEYS = Array.from({ length: 8 }, () => rand());
  var CASTLING_KEYS = Array.from({ length: 16 }, () => rand());
  var SIDE_KEY = rand();
  var WHITE = "w";
  var BLACK = "b";
  var PAWN = "p";
  var KNIGHT = "n";
  var BISHOP = "b";
  var ROOK = "r";
  var QUEEN = "q";
  var KING = "k";
  var DEFAULT_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  var Move = class {
    color;
    from;
    to;
    piece;
    captured;
    promotion;
    /**
     * @deprecated This field is deprecated and will be removed in version 2.0.0.
     * Please use move descriptor functions instead: `isCapture`, `isPromotion`,
     * `isEnPassant`, `isKingsideCastle`, `isQueensideCastle`, `isCastle`, and
     * `isBigPawn`
     */
    flags;
    san;
    lan;
    before;
    after;
    constructor(chess, internal) {
      const { color, piece, from, to, flags, captured, promotion } = internal;
      const fromAlgebraic = algebraic(from);
      const toAlgebraic = algebraic(to);
      this.color = color;
      this.piece = piece;
      this.from = fromAlgebraic;
      this.to = toAlgebraic;
      this.san = chess["_moveToSan"](internal, chess["_moves"]({ legal: true }));
      this.lan = fromAlgebraic + toAlgebraic;
      this.before = chess.fen();
      chess["_makeMove"](internal);
      this.after = chess.fen();
      chess["_undoMove"]();
      this.flags = "";
      for (const flag in BITS) {
        if (BITS[flag] & flags) {
          this.flags += FLAGS[flag];
        }
      }
      if (captured) {
        this.captured = captured;
      }
      if (promotion) {
        this.promotion = promotion;
        this.lan += promotion;
      }
    }
    isCapture() {
      return this.flags.indexOf(FLAGS["CAPTURE"]) > -1;
    }
    isPromotion() {
      return this.flags.indexOf(FLAGS["PROMOTION"]) > -1;
    }
    isEnPassant() {
      return this.flags.indexOf(FLAGS["EP_CAPTURE"]) > -1;
    }
    isKingsideCastle() {
      return this.flags.indexOf(FLAGS["KSIDE_CASTLE"]) > -1;
    }
    isQueensideCastle() {
      return this.flags.indexOf(FLAGS["QSIDE_CASTLE"]) > -1;
    }
    isBigPawn() {
      return this.flags.indexOf(FLAGS["BIG_PAWN"]) > -1;
    }
  };
  var EMPTY = -1;
  var FLAGS = {
    NORMAL: "n",
    CAPTURE: "c",
    BIG_PAWN: "b",
    EP_CAPTURE: "e",
    PROMOTION: "p",
    KSIDE_CASTLE: "k",
    QSIDE_CASTLE: "q",
    NULL_MOVE: "-"
  };
  var BITS = {
    NORMAL: 1,
    CAPTURE: 2,
    BIG_PAWN: 4,
    EP_CAPTURE: 8,
    PROMOTION: 16,
    KSIDE_CASTLE: 32,
    QSIDE_CASTLE: 64,
    NULL_MOVE: 128
  };
  var SEVEN_TAG_ROSTER = {
    Event: "?",
    Site: "?",
    Date: "????.??.??",
    Round: "?",
    White: "?",
    Black: "?",
    Result: "*"
  };
  var SUPLEMENTAL_TAGS = {
    WhiteTitle: null,
    BlackTitle: null,
    WhiteElo: null,
    BlackElo: null,
    WhiteUSCF: null,
    BlackUSCF: null,
    WhiteNA: null,
    BlackNA: null,
    WhiteType: null,
    BlackType: null,
    EventDate: null,
    EventSponsor: null,
    Section: null,
    Stage: null,
    Board: null,
    Opening: null,
    Variation: null,
    SubVariation: null,
    ECO: null,
    NIC: null,
    Time: null,
    UTCTime: null,
    UTCDate: null,
    TimeControl: null,
    SetUp: null,
    FEN: null,
    Termination: null,
    Annotator: null,
    Mode: null,
    PlyCount: null
  };
  var HEADER_TEMPLATE = {
    ...SEVEN_TAG_ROSTER,
    ...SUPLEMENTAL_TAGS
  };
  var Ox88 = {
    a8: 0,
    b8: 1,
    c8: 2,
    d8: 3,
    e8: 4,
    f8: 5,
    g8: 6,
    h8: 7,
    a7: 16,
    b7: 17,
    c7: 18,
    d7: 19,
    e7: 20,
    f7: 21,
    g7: 22,
    h7: 23,
    a6: 32,
    b6: 33,
    c6: 34,
    d6: 35,
    e6: 36,
    f6: 37,
    g6: 38,
    h6: 39,
    a5: 48,
    b5: 49,
    c5: 50,
    d5: 51,
    e5: 52,
    f5: 53,
    g5: 54,
    h5: 55,
    a4: 64,
    b4: 65,
    c4: 66,
    d4: 67,
    e4: 68,
    f4: 69,
    g4: 70,
    h4: 71,
    a3: 80,
    b3: 81,
    c3: 82,
    d3: 83,
    e3: 84,
    f3: 85,
    g3: 86,
    h3: 87,
    a2: 96,
    b2: 97,
    c2: 98,
    d2: 99,
    e2: 100,
    f2: 101,
    g2: 102,
    h2: 103,
    a1: 112,
    b1: 113,
    c1: 114,
    d1: 115,
    e1: 116,
    f1: 117,
    g1: 118,
    h1: 119
  };
  var PAWN_OFFSETS = {
    b: [16, 32, 17, 15],
    w: [-16, -32, -17, -15]
  };
  var PIECE_OFFSETS = {
    n: [-18, -33, -31, -14, 18, 33, 31, 14],
    b: [-17, -15, 17, 15],
    r: [-16, 1, 16, -1],
    q: [-17, -16, -15, 1, 17, 16, 15, -1],
    k: [-17, -16, -15, 1, 17, 16, 15, -1]
  };
  var ATTACKS = [
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    24,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    2,
    24,
    2,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2,
    53,
    56,
    53,
    2,
    0,
    0,
    0,
    0,
    0,
    0,
    24,
    24,
    24,
    24,
    24,
    24,
    56,
    0,
    56,
    24,
    24,
    24,
    24,
    24,
    24,
    0,
    0,
    0,
    0,
    0,
    0,
    2,
    53,
    56,
    53,
    2,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    2,
    24,
    2,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    24,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    0,
    20
  ];
  var RAYS = [
    17,
    0,
    0,
    0,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    0,
    0,
    0,
    15,
    0,
    0,
    17,
    0,
    0,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    0,
    0,
    15,
    0,
    0,
    0,
    0,
    17,
    0,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    0,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    17,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    17,
    0,
    0,
    16,
    0,
    0,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    17,
    0,
    16,
    0,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    17,
    16,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    -16,
    -17,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    0,
    -16,
    0,
    -17,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    0,
    0,
    -16,
    0,
    0,
    -17,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    0,
    0,
    0,
    -16,
    0,
    0,
    0,
    -17,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    0,
    0,
    0,
    0,
    -16,
    0,
    0,
    0,
    0,
    -17,
    0,
    0,
    0,
    0,
    -15,
    0,
    0,
    0,
    0,
    0,
    -16,
    0,
    0,
    0,
    0,
    0,
    -17,
    0,
    0,
    -15,
    0,
    0,
    0,
    0,
    0,
    0,
    -16,
    0,
    0,
    0,
    0,
    0,
    0,
    -17
  ];
  var PIECE_MASKS = { p: 1, n: 2, b: 4, r: 8, q: 16, k: 32 };
  var SYMBOLS = "pnbrqkPNBRQK";
  var PROMOTIONS = [KNIGHT, BISHOP, ROOK, QUEEN];
  var RANK_1 = 7;
  var RANK_2 = 6;
  var RANK_7 = 1;
  var RANK_8 = 0;
  var SIDES = {
    [KING]: BITS.KSIDE_CASTLE,
    [QUEEN]: BITS.QSIDE_CASTLE
  };
  var ROOKS = {
    w: [
      { square: Ox88.a1, flag: BITS.QSIDE_CASTLE },
      { square: Ox88.h1, flag: BITS.KSIDE_CASTLE }
    ],
    b: [
      { square: Ox88.a8, flag: BITS.QSIDE_CASTLE },
      { square: Ox88.h8, flag: BITS.KSIDE_CASTLE }
    ]
  };
  var SECOND_RANK = { b: RANK_7, w: RANK_2 };
  var SAN_NULLMOVE = "--";
  function rank(square) {
    return square >> 4;
  }
  function file(square) {
    return square & 15;
  }
  function isDigit(c) {
    return "0123456789".indexOf(c) !== -1;
  }
  function algebraic(square) {
    const f = file(square);
    const r = rank(square);
    return "abcdefgh".substring(f, f + 1) + "87654321".substring(r, r + 1);
  }
  function swapColor(color) {
    return color === WHITE ? BLACK : WHITE;
  }
  function validateFen(fen) {
    const tokens = fen.split(/\s+/);
    if (tokens.length !== 6) {
      return {
        ok: false,
        error: "Invalid FEN: must contain six space-delimited fields"
      };
    }
    const moveNumber = parseInt(tokens[5], 10);
    if (isNaN(moveNumber) || moveNumber <= 0) {
      return {
        ok: false,
        error: "Invalid FEN: move number must be a positive integer"
      };
    }
    const halfMoves = parseInt(tokens[4], 10);
    if (isNaN(halfMoves) || halfMoves < 0) {
      return {
        ok: false,
        error: "Invalid FEN: half move counter number must be a non-negative integer"
      };
    }
    if (!/^(-|[abcdefgh][36])$/.test(tokens[3])) {
      return { ok: false, error: "Invalid FEN: en-passant square is invalid" };
    }
    if (/[^kKqQ-]/.test(tokens[2])) {
      return { ok: false, error: "Invalid FEN: castling availability is invalid" };
    }
    if (!/^(w|b)$/.test(tokens[1])) {
      return { ok: false, error: "Invalid FEN: side-to-move is invalid" };
    }
    const rows = tokens[0].split("/");
    if (rows.length !== 8) {
      return {
        ok: false,
        error: "Invalid FEN: piece data does not contain 8 '/'-delimited rows"
      };
    }
    for (let i = 0; i < rows.length; i++) {
      let sumFields = 0;
      let previousWasNumber = false;
      for (let k = 0; k < rows[i].length; k++) {
        if (isDigit(rows[i][k])) {
          if (previousWasNumber) {
            return {
              ok: false,
              error: "Invalid FEN: piece data is invalid (consecutive number)"
            };
          }
          sumFields += parseInt(rows[i][k], 10);
          previousWasNumber = true;
        } else {
          if (!/^[prnbqkPRNBQK]$/.test(rows[i][k])) {
            return {
              ok: false,
              error: "Invalid FEN: piece data is invalid (invalid piece)"
            };
          }
          sumFields += 1;
          previousWasNumber = false;
        }
      }
      if (sumFields !== 8) {
        return {
          ok: false,
          error: "Invalid FEN: piece data is invalid (too many squares in rank)"
        };
      }
    }
    if (tokens[3][1] == "3" && tokens[1] == "w" || tokens[3][1] == "6" && tokens[1] == "b") {
      return { ok: false, error: "Invalid FEN: illegal en-passant square" };
    }
    const kings = [
      { color: "white", regex: /K/g },
      { color: "black", regex: /k/g }
    ];
    for (const { color, regex } of kings) {
      if (!regex.test(tokens[0])) {
        return { ok: false, error: `Invalid FEN: missing ${color} king` };
      }
      if ((tokens[0].match(regex) || []).length > 1) {
        return { ok: false, error: `Invalid FEN: too many ${color} kings` };
      }
    }
    if (Array.from(rows[0] + rows[7]).some((char) => char.toUpperCase() === "P")) {
      return {
        ok: false,
        error: "Invalid FEN: some pawns are on the edge rows"
      };
    }
    return { ok: true };
  }
  function getDisambiguator(move2, moves) {
    const from = move2.from;
    const to = move2.to;
    const piece = move2.piece;
    let ambiguities = 0;
    let sameRank = 0;
    let sameFile = 0;
    for (let i = 0, len = moves.length; i < len; i++) {
      const ambigFrom = moves[i].from;
      const ambigTo = moves[i].to;
      const ambigPiece = moves[i].piece;
      if (piece === ambigPiece && from !== ambigFrom && to === ambigTo) {
        ambiguities++;
        if (rank(from) === rank(ambigFrom)) {
          sameRank++;
        }
        if (file(from) === file(ambigFrom)) {
          sameFile++;
        }
      }
    }
    if (ambiguities > 0) {
      if (sameRank > 0 && sameFile > 0) {
        return algebraic(from);
      } else if (sameFile > 0) {
        return algebraic(from).charAt(1);
      } else {
        return algebraic(from).charAt(0);
      }
    }
    return "";
  }
  function addMove(moves, color, from, to, piece, captured = void 0, flags = BITS.NORMAL) {
    const r = rank(to);
    if (piece === PAWN && (r === RANK_1 || r === RANK_8)) {
      for (let i = 0; i < PROMOTIONS.length; i++) {
        const promotion = PROMOTIONS[i];
        moves.push({
          color,
          from,
          to,
          piece,
          captured,
          promotion,
          flags: flags | BITS.PROMOTION
        });
      }
    } else {
      moves.push({
        color,
        from,
        to,
        piece,
        captured,
        flags
      });
    }
  }
  function inferPieceType(san) {
    let pieceType = san.charAt(0);
    if (pieceType >= "a" && pieceType <= "h") {
      const matches = san.match(/[a-h]\d.*[a-h]\d/);
      if (matches) {
        return void 0;
      }
      return PAWN;
    }
    pieceType = pieceType.toLowerCase();
    if (pieceType === "o") {
      return KING;
    }
    return pieceType;
  }
  function strippedSan(move2) {
    return move2.replace(/=/, "").replace(/[+#]?[?!]*$/, "");
  }
  var Chess = class {
    _board = new Array(128);
    _turn = WHITE;
    _header = {};
    _kings = { w: EMPTY, b: EMPTY };
    _epSquare = -1;
    _halfMoves = 0;
    _moveNumber = 0;
    _history = [];
    _comments = {};
    _castling = { w: 0, b: 0 };
    _hash = 0n;
    // tracks number of times a position has been seen for repetition checking
    _positionCount = /* @__PURE__ */ new Map();
    constructor(fen = DEFAULT_POSITION, { skipValidation = false } = {}) {
      this.load(fen, { skipValidation });
    }
    clear({ preserveHeaders = false } = {}) {
      this._board = new Array(128);
      this._kings = { w: EMPTY, b: EMPTY };
      this._turn = WHITE;
      this._castling = { w: 0, b: 0 };
      this._epSquare = EMPTY;
      this._halfMoves = 0;
      this._moveNumber = 1;
      this._history = [];
      this._comments = {};
      this._header = preserveHeaders ? this._header : { ...HEADER_TEMPLATE };
      this._hash = this._computeHash();
      this._positionCount = /* @__PURE__ */ new Map();
      this._header["SetUp"] = null;
      this._header["FEN"] = null;
    }
    load(fen, { skipValidation = false, preserveHeaders = false } = {}) {
      let tokens = fen.split(/\s+/);
      if (tokens.length >= 2 && tokens.length < 6) {
        const adjustments = ["-", "-", "0", "1"];
        fen = tokens.concat(adjustments.slice(-(6 - tokens.length))).join(" ");
      }
      tokens = fen.split(/\s+/);
      if (!skipValidation) {
        const { ok, error } = validateFen(fen);
        if (!ok) {
          throw new Error(error);
        }
      }
      const position2 = tokens[0];
      let square = 0;
      this.clear({ preserveHeaders });
      for (let i = 0; i < position2.length; i++) {
        const piece = position2.charAt(i);
        if (piece === "/") {
          square += 8;
        } else if (isDigit(piece)) {
          square += parseInt(piece, 10);
        } else {
          const color = piece < "a" ? WHITE : BLACK;
          this._put({ type: piece.toLowerCase(), color }, algebraic(square));
          square++;
        }
      }
      this._turn = tokens[1];
      if (tokens[2].indexOf("K") > -1) {
        this._castling.w |= BITS.KSIDE_CASTLE;
      }
      if (tokens[2].indexOf("Q") > -1) {
        this._castling.w |= BITS.QSIDE_CASTLE;
      }
      if (tokens[2].indexOf("k") > -1) {
        this._castling.b |= BITS.KSIDE_CASTLE;
      }
      if (tokens[2].indexOf("q") > -1) {
        this._castling.b |= BITS.QSIDE_CASTLE;
      }
      this._epSquare = tokens[3] === "-" ? EMPTY : Ox88[tokens[3]];
      this._halfMoves = parseInt(tokens[4], 10);
      this._moveNumber = parseInt(tokens[5], 10);
      this._hash = this._computeHash();
      this._updateSetup(fen);
      this._incPositionCount();
    }
    fen({ forceEnpassantSquare = false } = {}) {
      let empty = 0;
      let fen = "";
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (this._board[i]) {
          if (empty > 0) {
            fen += empty;
            empty = 0;
          }
          const { color, type: piece } = this._board[i];
          fen += color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
        } else {
          empty++;
        }
        if (i + 1 & 136) {
          if (empty > 0) {
            fen += empty;
          }
          if (i !== Ox88.h1) {
            fen += "/";
          }
          empty = 0;
          i += 8;
        }
      }
      let castling = "";
      if (this._castling[WHITE] & BITS.KSIDE_CASTLE) {
        castling += "K";
      }
      if (this._castling[WHITE] & BITS.QSIDE_CASTLE) {
        castling += "Q";
      }
      if (this._castling[BLACK] & BITS.KSIDE_CASTLE) {
        castling += "k";
      }
      if (this._castling[BLACK] & BITS.QSIDE_CASTLE) {
        castling += "q";
      }
      castling = castling || "-";
      let epSquare = "-";
      if (this._epSquare !== EMPTY) {
        if (forceEnpassantSquare) {
          epSquare = algebraic(this._epSquare);
        } else {
          const bigPawnSquare = this._epSquare + (this._turn === WHITE ? 16 : -16);
          const squares = [bigPawnSquare + 1, bigPawnSquare - 1];
          for (const square of squares) {
            if (square & 136) {
              continue;
            }
            const color = this._turn;
            if (this._board[square]?.color === color && this._board[square]?.type === PAWN) {
              this._makeMove({
                color,
                from: square,
                to: this._epSquare,
                piece: PAWN,
                captured: PAWN,
                flags: BITS.EP_CAPTURE
              });
              const isLegal = !this._isKingAttacked(color);
              this._undoMove();
              if (isLegal) {
                epSquare = algebraic(this._epSquare);
                break;
              }
            }
          }
        }
      }
      return [
        fen,
        this._turn,
        castling,
        epSquare,
        this._halfMoves,
        this._moveNumber
      ].join(" ");
    }
    _pieceKey(i) {
      if (!this._board[i]) {
        return 0n;
      }
      const { color, type } = this._board[i];
      const colorIndex = {
        w: 0,
        b: 1
      }[color];
      const typeIndex = {
        p: 0,
        n: 1,
        b: 2,
        r: 3,
        q: 4,
        k: 5
      }[type];
      return PIECE_KEYS[colorIndex][typeIndex][i];
    }
    _epKey() {
      return this._epSquare === EMPTY ? 0n : EP_KEYS[this._epSquare & 7];
    }
    _castlingKey() {
      const index = this._castling.w >> 5 | this._castling.b >> 3;
      return CASTLING_KEYS[index];
    }
    _computeHash() {
      let hash = 0n;
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (i & 136) {
          i += 7;
          continue;
        }
        if (this._board[i]) {
          hash ^= this._pieceKey(i);
        }
      }
      hash ^= this._epKey();
      hash ^= this._castlingKey();
      if (this._turn === "b") {
        hash ^= SIDE_KEY;
      }
      return hash;
    }
    /*
     * Called when the initial board setup is changed with put() or remove().
     * modifies the SetUp and FEN properties of the header object. If the FEN
     * is equal to the default position, the SetUp and FEN are deleted the setup
     * is only updated if history.length is zero, ie moves haven't been made.
     */
    _updateSetup(fen) {
      if (this._history.length > 0)
        return;
      if (fen !== DEFAULT_POSITION) {
        this._header["SetUp"] = "1";
        this._header["FEN"] = fen;
      } else {
        this._header["SetUp"] = null;
        this._header["FEN"] = null;
      }
    }
    reset() {
      this.load(DEFAULT_POSITION);
    }
    get(square) {
      return this._board[Ox88[square]];
    }
    findPiece(piece) {
      const squares = [];
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (i & 136) {
          i += 7;
          continue;
        }
        if (!this._board[i] || this._board[i]?.color !== piece.color) {
          continue;
        }
        if (this._board[i].color === piece.color && this._board[i].type === piece.type) {
          squares.push(algebraic(i));
        }
      }
      return squares;
    }
    put({ type, color }, square) {
      if (this._put({ type, color }, square)) {
        this._updateCastlingRights();
        this._updateEnPassantSquare();
        this._updateSetup(this.fen());
        return true;
      }
      return false;
    }
    _set(sq, piece) {
      this._hash ^= this._pieceKey(sq);
      this._board[sq] = piece;
      this._hash ^= this._pieceKey(sq);
    }
    _put({ type, color }, square) {
      if (SYMBOLS.indexOf(type.toLowerCase()) === -1) {
        return false;
      }
      if (!(square in Ox88)) {
        return false;
      }
      const sq = Ox88[square];
      if (type == KING && !(this._kings[color] == EMPTY || this._kings[color] == sq)) {
        return false;
      }
      const currentPieceOnSquare = this._board[sq];
      if (currentPieceOnSquare && currentPieceOnSquare.type === KING) {
        this._kings[currentPieceOnSquare.color] = EMPTY;
      }
      this._set(sq, { type, color });
      if (type === KING) {
        this._kings[color] = sq;
      }
      return true;
    }
    _clear(sq) {
      this._hash ^= this._pieceKey(sq);
      delete this._board[sq];
    }
    remove(square) {
      const piece = this.get(square);
      this._clear(Ox88[square]);
      if (piece && piece.type === KING) {
        this._kings[piece.color] = EMPTY;
      }
      this._updateCastlingRights();
      this._updateEnPassantSquare();
      this._updateSetup(this.fen());
      return piece;
    }
    _updateCastlingRights() {
      this._hash ^= this._castlingKey();
      const whiteKingInPlace = this._board[Ox88.e1]?.type === KING && this._board[Ox88.e1]?.color === WHITE;
      const blackKingInPlace = this._board[Ox88.e8]?.type === KING && this._board[Ox88.e8]?.color === BLACK;
      if (!whiteKingInPlace || this._board[Ox88.a1]?.type !== ROOK || this._board[Ox88.a1]?.color !== WHITE) {
        this._castling.w &= -65;
      }
      if (!whiteKingInPlace || this._board[Ox88.h1]?.type !== ROOK || this._board[Ox88.h1]?.color !== WHITE) {
        this._castling.w &= -33;
      }
      if (!blackKingInPlace || this._board[Ox88.a8]?.type !== ROOK || this._board[Ox88.a8]?.color !== BLACK) {
        this._castling.b &= -65;
      }
      if (!blackKingInPlace || this._board[Ox88.h8]?.type !== ROOK || this._board[Ox88.h8]?.color !== BLACK) {
        this._castling.b &= -33;
      }
      this._hash ^= this._castlingKey();
    }
    _updateEnPassantSquare() {
      if (this._epSquare === EMPTY) {
        return;
      }
      const startSquare = this._epSquare + (this._turn === WHITE ? -16 : 16);
      const currentSquare = this._epSquare + (this._turn === WHITE ? 16 : -16);
      const attackers = [currentSquare + 1, currentSquare - 1];
      if (this._board[startSquare] !== null || this._board[this._epSquare] !== null || this._board[currentSquare]?.color !== swapColor(this._turn) || this._board[currentSquare]?.type !== PAWN) {
        this._hash ^= this._epKey();
        this._epSquare = EMPTY;
        return;
      }
      const canCapture = (square) => !(square & 136) && this._board[square]?.color === this._turn && this._board[square]?.type === PAWN;
      if (!attackers.some(canCapture)) {
        this._hash ^= this._epKey();
        this._epSquare = EMPTY;
      }
    }
    _attacked(color, square, verbose) {
      const attackers = [];
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (i & 136) {
          i += 7;
          continue;
        }
        if (this._board[i] === void 0 || this._board[i].color !== color) {
          continue;
        }
        const piece = this._board[i];
        const difference = i - square;
        if (difference === 0) {
          continue;
        }
        const index = difference + 119;
        if (ATTACKS[index] & PIECE_MASKS[piece.type]) {
          if (piece.type === PAWN) {
            if (difference > 0 && piece.color === WHITE || difference <= 0 && piece.color === BLACK) {
              if (!verbose) {
                return true;
              } else {
                attackers.push(algebraic(i));
              }
            }
            continue;
          }
          if (piece.type === "n" || piece.type === "k") {
            if (!verbose) {
              return true;
            } else {
              attackers.push(algebraic(i));
              continue;
            }
          }
          const offset = RAYS[index];
          let j = i + offset;
          let blocked = false;
          while (j !== square) {
            if (this._board[j] != null) {
              blocked = true;
              break;
            }
            j += offset;
          }
          if (!blocked) {
            if (!verbose) {
              return true;
            } else {
              attackers.push(algebraic(i));
              continue;
            }
          }
        }
      }
      if (verbose) {
        return attackers;
      } else {
        return false;
      }
    }
    attackers(square, attackedBy) {
      if (!attackedBy) {
        return this._attacked(this._turn, Ox88[square], true);
      } else {
        return this._attacked(attackedBy, Ox88[square], true);
      }
    }
    _isKingAttacked(color) {
      const square = this._kings[color];
      return square === -1 ? false : this._attacked(swapColor(color), square);
    }
    hash() {
      return this._hash.toString(16);
    }
    isAttacked(square, attackedBy) {
      return this._attacked(attackedBy, Ox88[square]);
    }
    isCheck() {
      return this._isKingAttacked(this._turn);
    }
    inCheck() {
      return this.isCheck();
    }
    isCheckmate() {
      return this.isCheck() && this._moves().length === 0;
    }
    isStalemate() {
      return !this.isCheck() && this._moves().length === 0;
    }
    isInsufficientMaterial() {
      const pieces = {
        b: 0,
        n: 0,
        r: 0,
        q: 0,
        k: 0,
        p: 0
      };
      const bishops = [];
      let numPieces = 0;
      let squareColor = 0;
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        squareColor = (squareColor + 1) % 2;
        if (i & 136) {
          i += 7;
          continue;
        }
        const piece = this._board[i];
        if (piece) {
          pieces[piece.type] = piece.type in pieces ? pieces[piece.type] + 1 : 1;
          if (piece.type === BISHOP) {
            bishops.push(squareColor);
          }
          numPieces++;
        }
      }
      if (numPieces === 2) {
        return true;
      } else if (
        // k vs. kn .... or .... k vs. kb
        numPieces === 3 && (pieces[BISHOP] === 1 || pieces[KNIGHT] === 1)
      ) {
        return true;
      } else if (numPieces === pieces[BISHOP] + 2) {
        let sum = 0;
        const len = bishops.length;
        for (let i = 0; i < len; i++) {
          sum += bishops[i];
        }
        if (sum === 0 || sum === len) {
          return true;
        }
      }
      return false;
    }
    isThreefoldRepetition() {
      return this._getPositionCount(this._hash) >= 3;
    }
    isDrawByFiftyMoves() {
      return this._halfMoves >= 100;
    }
    isDraw() {
      return this.isDrawByFiftyMoves() || this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition();
    }
    isGameOver() {
      return this.isCheckmate() || this.isDraw();
    }
    moves({ verbose = false, square = void 0, piece = void 0 } = {}) {
      const moves = this._moves({ square, piece });
      if (verbose) {
        return moves.map((move2) => new Move(this, move2));
      } else {
        return moves.map((move2) => this._moveToSan(move2, moves));
      }
    }
    _moves({ legal = true, piece = void 0, square = void 0 } = {}) {
      const forSquare = square ? square.toLowerCase() : void 0;
      const forPiece = piece?.toLowerCase();
      const moves = [];
      const us = this._turn;
      const them = swapColor(us);
      let firstSquare = Ox88.a8;
      let lastSquare = Ox88.h1;
      let singleSquare = false;
      if (forSquare) {
        if (!(forSquare in Ox88)) {
          return [];
        } else {
          firstSquare = lastSquare = Ox88[forSquare];
          singleSquare = true;
        }
      }
      for (let from = firstSquare; from <= lastSquare; from++) {
        if (from & 136) {
          from += 7;
          continue;
        }
        if (!this._board[from] || this._board[from].color === them) {
          continue;
        }
        const { type } = this._board[from];
        let to;
        if (type === PAWN) {
          if (forPiece && forPiece !== type)
            continue;
          to = from + PAWN_OFFSETS[us][0];
          if (!this._board[to]) {
            addMove(moves, us, from, to, PAWN);
            to = from + PAWN_OFFSETS[us][1];
            if (SECOND_RANK[us] === rank(from) && !this._board[to]) {
              addMove(moves, us, from, to, PAWN, void 0, BITS.BIG_PAWN);
            }
          }
          for (let j = 2; j < 4; j++) {
            to = from + PAWN_OFFSETS[us][j];
            if (to & 136)
              continue;
            if (this._board[to]?.color === them) {
              addMove(moves, us, from, to, PAWN, this._board[to].type, BITS.CAPTURE);
            } else if (to === this._epSquare) {
              addMove(moves, us, from, to, PAWN, PAWN, BITS.EP_CAPTURE);
            }
          }
        } else {
          if (forPiece && forPiece !== type)
            continue;
          for (let j = 0, len = PIECE_OFFSETS[type].length; j < len; j++) {
            const offset = PIECE_OFFSETS[type][j];
            to = from;
            while (true) {
              to += offset;
              if (to & 136)
                break;
              if (!this._board[to]) {
                addMove(moves, us, from, to, type);
              } else {
                if (this._board[to].color === us)
                  break;
                addMove(moves, us, from, to, type, this._board[to].type, BITS.CAPTURE);
                break;
              }
              if (type === KNIGHT || type === KING)
                break;
            }
          }
        }
      }
      if (forPiece === void 0 || forPiece === KING) {
        if (!singleSquare || lastSquare === this._kings[us]) {
          if (this._castling[us] & BITS.KSIDE_CASTLE) {
            const castlingFrom = this._kings[us];
            const castlingTo = castlingFrom + 2;
            if (!this._board[castlingFrom + 1] && !this._board[castlingTo] && !this._attacked(them, this._kings[us]) && !this._attacked(them, castlingFrom + 1) && !this._attacked(them, castlingTo)) {
              addMove(moves, us, this._kings[us], castlingTo, KING, void 0, BITS.KSIDE_CASTLE);
            }
          }
          if (this._castling[us] & BITS.QSIDE_CASTLE) {
            const castlingFrom = this._kings[us];
            const castlingTo = castlingFrom - 2;
            if (!this._board[castlingFrom - 1] && !this._board[castlingFrom - 2] && !this._board[castlingFrom - 3] && !this._attacked(them, this._kings[us]) && !this._attacked(them, castlingFrom - 1) && !this._attacked(them, castlingTo)) {
              addMove(moves, us, this._kings[us], castlingTo, KING, void 0, BITS.QSIDE_CASTLE);
            }
          }
        }
      }
      if (!legal || this._kings[us] === -1) {
        return moves;
      }
      const legalMoves = [];
      for (let i = 0, len = moves.length; i < len; i++) {
        this._makeMove(moves[i]);
        if (!this._isKingAttacked(us)) {
          legalMoves.push(moves[i]);
        }
        this._undoMove();
      }
      return legalMoves;
    }
    move(move2, { strict = false } = {}) {
      let moveObj = null;
      if (typeof move2 === "string") {
        moveObj = this._moveFromSan(move2, strict);
      } else if (move2 === null) {
        moveObj = this._moveFromSan(SAN_NULLMOVE, strict);
      } else if (typeof move2 === "object") {
        const moves = this._moves();
        for (let i = 0, len = moves.length; i < len; i++) {
          if (move2.from === algebraic(moves[i].from) && move2.to === algebraic(moves[i].to) && (!("promotion" in moves[i]) || move2.promotion === moves[i].promotion)) {
            moveObj = moves[i];
            break;
          }
        }
      }
      if (!moveObj) {
        if (typeof move2 === "string") {
          throw new Error(`Invalid move: ${move2}`);
        } else {
          throw new Error(`Invalid move: ${JSON.stringify(move2)}`);
        }
      }
      if (this.isCheck() && moveObj.flags & BITS.NULL_MOVE) {
        throw new Error("Null move not allowed when in check");
      }
      const prettyMove = new Move(this, moveObj);
      this._makeMove(moveObj);
      this._incPositionCount();
      return prettyMove;
    }
    _push(move2) {
      this._history.push({
        move: move2,
        kings: { b: this._kings.b, w: this._kings.w },
        turn: this._turn,
        castling: { b: this._castling.b, w: this._castling.w },
        epSquare: this._epSquare,
        halfMoves: this._halfMoves,
        moveNumber: this._moveNumber
      });
    }
    _movePiece(from, to) {
      this._hash ^= this._pieceKey(from);
      this._board[to] = this._board[from];
      delete this._board[from];
      this._hash ^= this._pieceKey(to);
    }
    _makeMove(move2) {
      const us = this._turn;
      const them = swapColor(us);
      this._push(move2);
      if (move2.flags & BITS.NULL_MOVE) {
        if (us === BLACK) {
          this._moveNumber++;
        }
        this._halfMoves++;
        this._turn = them;
        this._epSquare = EMPTY;
        return;
      }
      this._hash ^= this._epKey();
      this._hash ^= this._castlingKey();
      if (move2.captured) {
        this._hash ^= this._pieceKey(move2.to);
      }
      this._movePiece(move2.from, move2.to);
      if (move2.flags & BITS.EP_CAPTURE) {
        if (this._turn === BLACK) {
          this._clear(move2.to - 16);
        } else {
          this._clear(move2.to + 16);
        }
      }
      if (move2.promotion) {
        this._clear(move2.to);
        this._set(move2.to, { type: move2.promotion, color: us });
      }
      if (this._board[move2.to].type === KING) {
        this._kings[us] = move2.to;
        if (move2.flags & BITS.KSIDE_CASTLE) {
          const castlingTo = move2.to - 1;
          const castlingFrom = move2.to + 1;
          this._movePiece(castlingFrom, castlingTo);
        } else if (move2.flags & BITS.QSIDE_CASTLE) {
          const castlingTo = move2.to + 1;
          const castlingFrom = move2.to - 2;
          this._movePiece(castlingFrom, castlingTo);
        }
        this._castling[us] = 0;
      }
      if (this._castling[us]) {
        for (let i = 0, len = ROOKS[us].length; i < len; i++) {
          if (move2.from === ROOKS[us][i].square && this._castling[us] & ROOKS[us][i].flag) {
            this._castling[us] ^= ROOKS[us][i].flag;
            break;
          }
        }
      }
      if (this._castling[them]) {
        for (let i = 0, len = ROOKS[them].length; i < len; i++) {
          if (move2.to === ROOKS[them][i].square && this._castling[them] & ROOKS[them][i].flag) {
            this._castling[them] ^= ROOKS[them][i].flag;
            break;
          }
        }
      }
      this._hash ^= this._castlingKey();
      if (move2.flags & BITS.BIG_PAWN) {
        let epSquare;
        if (us === BLACK) {
          epSquare = move2.to - 16;
        } else {
          epSquare = move2.to + 16;
        }
        if (!(move2.to - 1 & 136) && this._board[move2.to - 1]?.type === PAWN && this._board[move2.to - 1]?.color === them || !(move2.to + 1 & 136) && this._board[move2.to + 1]?.type === PAWN && this._board[move2.to + 1]?.color === them) {
          this._epSquare = epSquare;
          this._hash ^= this._epKey();
        } else {
          this._epSquare = EMPTY;
        }
      } else {
        this._epSquare = EMPTY;
      }
      if (move2.piece === PAWN) {
        this._halfMoves = 0;
      } else if (move2.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
        this._halfMoves = 0;
      } else {
        this._halfMoves++;
      }
      if (us === BLACK) {
        this._moveNumber++;
      }
      this._turn = them;
      this._hash ^= SIDE_KEY;
    }
    undo() {
      const hash = this._hash;
      const move2 = this._undoMove();
      if (move2) {
        const prettyMove = new Move(this, move2);
        this._decPositionCount(hash);
        return prettyMove;
      }
      return null;
    }
    _undoMove() {
      const old = this._history.pop();
      if (old === void 0) {
        return null;
      }
      this._hash ^= this._epKey();
      this._hash ^= this._castlingKey();
      const move2 = old.move;
      this._kings = old.kings;
      this._turn = old.turn;
      this._castling = old.castling;
      this._epSquare = old.epSquare;
      this._halfMoves = old.halfMoves;
      this._moveNumber = old.moveNumber;
      this._hash ^= this._epKey();
      this._hash ^= this._castlingKey();
      this._hash ^= SIDE_KEY;
      const us = this._turn;
      const them = swapColor(us);
      if (move2.flags & BITS.NULL_MOVE) {
        return move2;
      }
      this._movePiece(move2.to, move2.from);
      if (move2.piece) {
        this._clear(move2.from);
        this._set(move2.from, { type: move2.piece, color: us });
      }
      if (move2.captured) {
        if (move2.flags & BITS.EP_CAPTURE) {
          let index;
          if (us === BLACK) {
            index = move2.to - 16;
          } else {
            index = move2.to + 16;
          }
          this._set(index, { type: PAWN, color: them });
        } else {
          this._set(move2.to, { type: move2.captured, color: them });
        }
      }
      if (move2.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
        let castlingTo, castlingFrom;
        if (move2.flags & BITS.KSIDE_CASTLE) {
          castlingTo = move2.to + 1;
          castlingFrom = move2.to - 1;
        } else {
          castlingTo = move2.to - 2;
          castlingFrom = move2.to + 1;
        }
        this._movePiece(castlingFrom, castlingTo);
      }
      return move2;
    }
    pgn({ newline = "\n", maxWidth = 0 } = {}) {
      const result = [];
      let headerExists = false;
      for (const i in this._header) {
        const headerTag = this._header[i];
        if (headerTag)
          result.push(`[${i} "${this._header[i]}"]` + newline);
        headerExists = true;
      }
      if (headerExists && this._history.length) {
        result.push(newline);
      }
      const appendComment = (moveString2) => {
        const comment = this._comments[this.fen()];
        if (typeof comment !== "undefined") {
          const delimiter = moveString2.length > 0 ? " " : "";
          moveString2 = `${moveString2}${delimiter}{${comment}}`;
        }
        return moveString2;
      };
      const reversedHistory = [];
      while (this._history.length > 0) {
        reversedHistory.push(this._undoMove());
      }
      const moves = [];
      let moveString = "";
      if (reversedHistory.length === 0) {
        moves.push(appendComment(""));
      }
      while (reversedHistory.length > 0) {
        moveString = appendComment(moveString);
        const move2 = reversedHistory.pop();
        if (!move2) {
          break;
        }
        if (!this._history.length && move2.color === "b") {
          const prefix = `${this._moveNumber}. ...`;
          moveString = moveString ? `${moveString} ${prefix}` : prefix;
        } else if (move2.color === "w") {
          if (moveString.length) {
            moves.push(moveString);
          }
          moveString = this._moveNumber + ".";
        }
        moveString = moveString + " " + this._moveToSan(move2, this._moves({ legal: true }));
        this._makeMove(move2);
      }
      if (moveString.length) {
        moves.push(appendComment(moveString));
      }
      moves.push(this._header.Result || "*");
      if (maxWidth === 0) {
        return result.join("") + moves.join(" ");
      }
      const strip = function() {
        if (result.length > 0 && result[result.length - 1] === " ") {
          result.pop();
          return true;
        }
        return false;
      };
      const wrapComment = function(width, move2) {
        for (const token of move2.split(" ")) {
          if (!token) {
            continue;
          }
          if (width + token.length > maxWidth) {
            while (strip()) {
              width--;
            }
            result.push(newline);
            width = 0;
          }
          result.push(token);
          width += token.length;
          result.push(" ");
          width++;
        }
        if (strip()) {
          width--;
        }
        return width;
      };
      let currentWidth = 0;
      for (let i = 0; i < moves.length; i++) {
        if (currentWidth + moves[i].length > maxWidth) {
          if (moves[i].includes("{")) {
            currentWidth = wrapComment(currentWidth, moves[i]);
            continue;
          }
        }
        if (currentWidth + moves[i].length > maxWidth && i !== 0) {
          if (result[result.length - 1] === " ") {
            result.pop();
          }
          result.push(newline);
          currentWidth = 0;
        } else if (i !== 0) {
          result.push(" ");
          currentWidth++;
        }
        result.push(moves[i]);
        currentWidth += moves[i].length;
      }
      return result.join("");
    }
    /**
     * @deprecated Use `setHeader` and `getHeaders` instead. This method will return null header tags (which is not what you want)
     */
    header(...args) {
      for (let i = 0; i < args.length; i += 2) {
        if (typeof args[i] === "string" && typeof args[i + 1] === "string") {
          this._header[args[i]] = args[i + 1];
        }
      }
      return this._header;
    }
    // TODO: value validation per spec
    setHeader(key, value) {
      this._header[key] = value ?? SEVEN_TAG_ROSTER[key] ?? null;
      return this.getHeaders();
    }
    removeHeader(key) {
      if (key in this._header) {
        this._header[key] = SEVEN_TAG_ROSTER[key] || null;
        return true;
      }
      return false;
    }
    // return only non-null headers (omit placemarker nulls)
    getHeaders() {
      const nonNullHeaders = {};
      for (const [key, value] of Object.entries(this._header)) {
        if (value !== null) {
          nonNullHeaders[key] = value;
        }
      }
      return nonNullHeaders;
    }
    loadPgn(pgn2, { strict = false, newlineChar = "\r?\n" } = {}) {
      if (newlineChar !== "\r?\n") {
        pgn2 = pgn2.replace(new RegExp(newlineChar, "g"), "\n");
      }
      const parsedPgn = peg$parse(pgn2);
      this.reset();
      const headers = parsedPgn.headers;
      let fen = "";
      for (const key in headers) {
        if (key.toLowerCase() === "fen") {
          fen = headers[key];
        }
        this.header(key, headers[key]);
      }
      if (!strict) {
        if (fen) {
          this.load(fen, { preserveHeaders: true });
        }
      } else {
        if (headers["SetUp"] === "1") {
          if (!("FEN" in headers)) {
            throw new Error("Invalid PGN: FEN tag must be supplied with SetUp tag");
          }
          this.load(headers["FEN"], { preserveHeaders: true });
        }
      }
      let node2 = parsedPgn.root;
      while (node2) {
        if (node2.move) {
          const move2 = this._moveFromSan(node2.move, strict);
          if (move2 == null) {
            throw new Error(`Invalid move in PGN: ${node2.move}`);
          } else {
            this._makeMove(move2);
            this._incPositionCount();
          }
        }
        if (node2.comment !== void 0) {
          this._comments[this.fen()] = node2.comment;
        }
        node2 = node2.variations[0];
      }
      const result = parsedPgn.result;
      if (result && Object.keys(this._header).length && this._header["Result"] !== result) {
        this.setHeader("Result", result);
      }
    }
    /*
     * Convert a move from 0x88 coordinates to Standard Algebraic Notation
     * (SAN)
     *
     * @param {boolean} strict Use the strict SAN parser. It will throw errors
     * on overly disambiguated moves (see below):
     *
     * r1bqkbnr/ppp2ppp/2n5/1B1pP3/4P3/8/PPPP2PP/RNBQK1NR b KQkq - 2 4
     * 4. ... Nge7 is overly disambiguated because the knight on c6 is pinned
     * 4. ... Ne7 is technically the valid SAN
     */
    _moveToSan(move2, moves) {
      let output = "";
      if (move2.flags & BITS.KSIDE_CASTLE) {
        output = "O-O";
      } else if (move2.flags & BITS.QSIDE_CASTLE) {
        output = "O-O-O";
      } else if (move2.flags & BITS.NULL_MOVE) {
        return SAN_NULLMOVE;
      } else {
        if (move2.piece !== PAWN) {
          const disambiguator = getDisambiguator(move2, moves);
          output += move2.piece.toUpperCase() + disambiguator;
        }
        if (move2.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
          if (move2.piece === PAWN) {
            output += algebraic(move2.from)[0];
          }
          output += "x";
        }
        output += algebraic(move2.to);
        if (move2.promotion) {
          output += "=" + move2.promotion.toUpperCase();
        }
      }
      this._makeMove(move2);
      if (this.isCheck()) {
        if (this.isCheckmate()) {
          output += "#";
        } else {
          output += "+";
        }
      }
      this._undoMove();
      return output;
    }
    // convert a move from Standard Algebraic Notation (SAN) to 0x88 coordinates
    _moveFromSan(move2, strict = false) {
      let cleanMove = strippedSan(move2);
      if (!strict) {
        if (cleanMove === "0-0") {
          cleanMove = "O-O";
        } else if (cleanMove === "0-0-0") {
          cleanMove = "O-O-O";
        }
      }
      if (cleanMove == SAN_NULLMOVE) {
        const res = {
          color: this._turn,
          from: 0,
          to: 0,
          piece: "k",
          flags: BITS.NULL_MOVE
        };
        return res;
      }
      let pieceType = inferPieceType(cleanMove);
      let moves = this._moves({ legal: true, piece: pieceType });
      for (let i = 0, len = moves.length; i < len; i++) {
        if (cleanMove === strippedSan(this._moveToSan(moves[i], moves))) {
          return moves[i];
        }
      }
      if (strict) {
        return null;
      }
      let piece = void 0;
      let matches = void 0;
      let from = void 0;
      let to = void 0;
      let promotion = void 0;
      let overlyDisambiguated = false;
      matches = cleanMove.match(/([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/);
      if (matches) {
        piece = matches[1];
        from = matches[2];
        to = matches[3];
        promotion = matches[4];
        if (from.length == 1) {
          overlyDisambiguated = true;
        }
      } else {
        matches = cleanMove.match(/([pnbrqkPNBRQK])?([a-h]?[1-8]?)x?-?([a-h][1-8])([qrbnQRBN])?/);
        if (matches) {
          piece = matches[1];
          from = matches[2];
          to = matches[3];
          promotion = matches[4];
          if (from.length == 1) {
            overlyDisambiguated = true;
          }
        }
      }
      pieceType = inferPieceType(cleanMove);
      moves = this._moves({
        legal: true,
        piece: piece ? piece : pieceType
      });
      if (!to) {
        return null;
      }
      for (let i = 0, len = moves.length; i < len; i++) {
        if (!from) {
          if (cleanMove === strippedSan(this._moveToSan(moves[i], moves)).replace("x", "")) {
            return moves[i];
          }
        } else if ((!piece || piece.toLowerCase() == moves[i].piece) && Ox88[from] == moves[i].from && Ox88[to] == moves[i].to && (!promotion || promotion.toLowerCase() == moves[i].promotion)) {
          return moves[i];
        } else if (overlyDisambiguated) {
          const square = algebraic(moves[i].from);
          if ((!piece || piece.toLowerCase() == moves[i].piece) && Ox88[to] == moves[i].to && (from == square[0] || from == square[1]) && (!promotion || promotion.toLowerCase() == moves[i].promotion)) {
            return moves[i];
          }
        }
      }
      return null;
    }
    ascii() {
      let s = "   +------------------------+\n";
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (file(i) === 0) {
          s += " " + "87654321"[rank(i)] + " |";
        }
        if (this._board[i]) {
          const piece = this._board[i].type;
          const color = this._board[i].color;
          const symbol = color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
          s += " " + symbol + " ";
        } else {
          s += " . ";
        }
        if (i + 1 & 136) {
          s += "|\n";
          i += 8;
        }
      }
      s += "   +------------------------+\n";
      s += "     a  b  c  d  e  f  g  h";
      return s;
    }
    perft(depth) {
      const moves = this._moves({ legal: false });
      let nodes = 0;
      const color = this._turn;
      for (let i = 0, len = moves.length; i < len; i++) {
        this._makeMove(moves[i]);
        if (!this._isKingAttacked(color)) {
          if (depth - 1 > 0) {
            nodes += this.perft(depth - 1);
          } else {
            nodes++;
          }
        }
        this._undoMove();
      }
      return nodes;
    }
    setTurn(color) {
      if (this._turn == color) {
        return false;
      }
      this.move("--");
      return true;
    }
    turn() {
      return this._turn;
    }
    board() {
      const output = [];
      let row = [];
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (this._board[i] == null) {
          row.push(null);
        } else {
          row.push({
            square: algebraic(i),
            type: this._board[i].type,
            color: this._board[i].color
          });
        }
        if (i + 1 & 136) {
          output.push(row);
          row = [];
          i += 8;
        }
      }
      return output;
    }
    squareColor(square) {
      if (square in Ox88) {
        const sq = Ox88[square];
        return (rank(sq) + file(sq)) % 2 === 0 ? "light" : "dark";
      }
      return null;
    }
    history({ verbose = false } = {}) {
      const reversedHistory = [];
      const moveHistory = [];
      while (this._history.length > 0) {
        reversedHistory.push(this._undoMove());
      }
      while (true) {
        const move2 = reversedHistory.pop();
        if (!move2) {
          break;
        }
        if (verbose) {
          moveHistory.push(new Move(this, move2));
        } else {
          moveHistory.push(this._moveToSan(move2, this._moves()));
        }
        this._makeMove(move2);
      }
      return moveHistory;
    }
    /*
     * Keeps track of position occurrence counts for the purpose of repetition
     * checking. Old positions are removed from the map if their counts are reduced to 0.
     */
    _getPositionCount(hash) {
      return this._positionCount.get(hash) ?? 0;
    }
    _incPositionCount() {
      this._positionCount.set(this._hash, (this._positionCount.get(this._hash) ?? 0) + 1);
    }
    _decPositionCount(hash) {
      const currentCount = this._positionCount.get(hash) ?? 0;
      if (currentCount === 1) {
        this._positionCount.delete(hash);
      } else {
        this._positionCount.set(hash, currentCount - 1);
      }
    }
    _pruneComments() {
      const reversedHistory = [];
      const currentComments = {};
      const copyComment = (fen) => {
        if (fen in this._comments) {
          currentComments[fen] = this._comments[fen];
        }
      };
      while (this._history.length > 0) {
        reversedHistory.push(this._undoMove());
      }
      copyComment(this.fen());
      while (true) {
        const move2 = reversedHistory.pop();
        if (!move2) {
          break;
        }
        this._makeMove(move2);
        copyComment(this.fen());
      }
      this._comments = currentComments;
    }
    getComment() {
      return this._comments[this.fen()];
    }
    setComment(comment) {
      this._comments[this.fen()] = comment.replace("{", "[").replace("}", "]");
    }
    /**
     * @deprecated Renamed to `removeComment` for consistency
     */
    deleteComment() {
      return this.removeComment();
    }
    removeComment() {
      const comment = this._comments[this.fen()];
      delete this._comments[this.fen()];
      return comment;
    }
    getComments() {
      this._pruneComments();
      return Object.keys(this._comments).map((fen) => {
        return { fen, comment: this._comments[fen] };
      });
    }
    /**
     * @deprecated Renamed to `removeComments` for consistency
     */
    deleteComments() {
      return this.removeComments();
    }
    removeComments() {
      this._pruneComments();
      return Object.keys(this._comments).map((fen) => {
        const comment = this._comments[fen];
        delete this._comments[fen];
        return { fen, comment };
      });
    }
    setCastlingRights(color, rights) {
      for (const side2 of [KING, QUEEN]) {
        if (rights[side2] !== void 0) {
          if (rights[side2]) {
            this._castling[color] |= SIDES[side2];
          } else {
            this._castling[color] &= ~SIDES[side2];
          }
        }
      }
      this._updateCastlingRights();
      const result = this.getCastlingRights(color);
      return (rights[KING] === void 0 || rights[KING] === result[KING]) && (rights[QUEEN] === void 0 || rights[QUEEN] === result[QUEEN]);
    }
    getCastlingRights(color) {
      return {
        [KING]: (this._castling[color] & SIDES[KING]) !== 0,
        [QUEEN]: (this._castling[color] & SIDES[QUEEN]) !== 0
      };
    }
    moveNumber() {
      return this._moveNumber;
    }
  };

  // src/content/position.js
  var FILES = "abcdefgh";
  var sqName = (i) => FILES[i % 8] + (Math.floor(i / 8) + 1);
  var sqIndex = (name) => (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);
  var START_PLACEMENT = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
  function placement(board) {
    const rows = [];
    for (let rank2 = 7; rank2 >= 0; rank2--) {
      let row = "";
      let empty = 0;
      for (let file2 = 0; file2 < 8; file2++) {
        const p = board[rank2 * 8 + file2];
        if (!p) {
          empty++;
        } else {
          if (empty) row += empty;
          empty = 0;
          row += p;
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return rows.join("/");
  }
  var colorOf = (p) => p === p.toUpperCase() ? "w" : "b";
  var count = (board) => board.reduce((n, p) => n + (p ? 1 : 0), 0);
  var RIGHTS = [
    { r: "K", king: "K", kingSq: 4, rook: "R", rookSq: 7 },
    { r: "Q", king: "K", kingSq: 4, rook: "R", rookSq: 0 },
    { r: "k", king: "k", kingSq: 60, rook: "r", rookSq: 63 },
    { r: "q", king: "k", kingSq: 60, rook: "r", rookSq: 56 }
  ];
  var CastleTracker = class {
    constructor() {
      this.reset();
    }
    reset() {
      this.lost = /* @__PURE__ */ new Set();
      this.prev = null;
    }
    update(board) {
      if (placement(board) === START_PLACEMENT) this.lost.clear();
      if (this.prev) {
        let diff = 0;
        for (let i = 0; i < 64; i++) if (board[i] !== this.prev[i]) diff++;
        if (diff > 4 || count(board) > count(this.prev)) this.lost.clear();
      }
      this.prev = board.slice();
      for (const { r, king, kingSq, rook, rookSq } of RIGHTS) {
        if (board[kingSq] !== king || board[rookSq] !== rook) this.lost.add(r);
      }
    }
    rights() {
      const s = RIGHTS.map((x) => x.r).filter((r) => !this.lost.has(r)).join("");
      return s || "-";
    }
  };
  function inferTurn(board, raw, override) {
    if (override === "w" || override === "b") return { turn: override, source: "manual" };
    if (raw.lastMove && raw.lastMove.length) {
      const colors = raw.lastMove.filter((i) => board[i]).map((i) => colorOf(board[i]));
      if (colors.length && colors.every((c) => c === colors[0])) {
        return { turn: colors[0] === "w" ? "b" : "w", source: "last-move" };
      }
    }
    if (raw.clockTurn) return { turn: raw.clockTurn, source: "clock" };
    if (placement(board) === START_PLACEMENT) return { turn: "w", source: "start" };
    return { turn: raw.orientation === "black" ? "b" : "w", source: "assumed" };
  }
  function enPassant(board, raw, turn) {
    if (!raw.lastMove || raw.lastMove.length !== 2) return "-";
    const [x, y] = raw.lastMove;
    const [from, to] = board[x] ? [y, x] : [x, y];
    if (board[from] || !board[to]) return "-";
    const pawn = board[to];
    if (pawn !== "P" && pawn !== "p") return "-";
    if (from % 8 !== to % 8 || Math.abs(Math.floor(from / 8) - Math.floor(to / 8)) !== 2) return "-";
    const next = colorOf(pawn) === "w" ? "b" : "w";
    return turn === next ? sqName((from + to) / 2) : "-";
  }
  function kingSquare(board, king) {
    return board.indexOf(king);
  }
  function tryLoad(board, turn, castling, ep) {
    const fen = `${placement(board)} ${turn} ${castling} ${ep} 0 1`;
    let chess;
    try {
      chess = new Chess(fen);
    } catch (e) {
      return { error: "err.parse" };
    }
    const oppKing = sqName(kingSquare(board, turn === "w" ? "k" : "K"));
    if (chess.isAttacked(oppKing, turn)) return { error: "err.impossible" };
    return { fen, chess };
  }
  function resolvePosition(raw, tracker2, { turnOverride = "auto" } = {}) {
    const board = raw.board;
    const wk = board.filter((p) => p === "K").length;
    const bk = board.filter((p) => p === "k").length;
    if (wk !== 1 || bk !== 1) return { error: "err.kings" };
    for (let i = 0; i < 8; i++) {
      if (/p/i.test(board[i] || "") || /p/i.test(board[56 + i] || "")) return { error: "err.pawn" };
    }
    tracker2.update(board);
    const castling = tracker2.rights();
    const guess = inferTurn(board, raw, turnOverride);
    let res = tryLoad(board, guess.turn, castling, enPassant(board, raw, guess.turn));
    let turn = guess.turn;
    let source = guess.source;
    if (res.error && guess.source !== "manual") {
      turn = guess.turn === "w" ? "b" : "w";
      res = tryLoad(board, turn, castling, enPassant(board, raw, turn));
      source = "corrected";
    }
    if (res.error) return { error: res.error };
    if (res.chess.isGameOver()) {
      const reason = res.chess.isCheckmate() ? "mate" : "draw";
      return { fen: res.fen, turn, source, over: reason };
    }
    return { fen: res.fen, turn, source };
  }

  // src/content/colors.js
  var DEFAULT_COLORS = ["#22c55e", "#2563eb", "#d97706", "#9333ea", "#64748b"];
  var HEX = /^#[0-9a-f]{6}$/i;
  function normalizeColors(list) {
    const src = Array.isArray(list) ? list : [];
    return DEFAULT_COLORS.map((d, i) => typeof src[i] === "string" && HEX.test(src[i]) ? src[i].toLowerCase() : d);
  }

  // src/content/overlay.js
  var NS = "http://www.w3.org/2000/svg";
  function center(sqIdx, orientation) {
    const file2 = sqIdx % 8;
    const rank2 = Math.floor(sqIdx / 8);
    const col = orientation === "white" ? file2 : 7 - file2;
    const row = orientation === "white" ? 7 - rank2 : rank2;
    return [col * 100 + 50, row * 100 + 50];
  }
  var GAP = 24;
  function spreadOffsets(geo) {
    const n = geo.length;
    const parent = geo.map((_, i) => i);
    const find = (i) => parent[i] === i ? i : parent[i] = find(parent[i]);
    const overlap = (a, b) => {
      if (Math.abs(a.ux * b.uy - a.uy * b.ux) > 0.05) return false;
      const dist = Math.abs((b.x1 - a.x1) * a.uy - (b.y1 - a.y1) * a.ux);
      if (dist > 20) return false;
      const proj = (px, py) => (px - a.x1) * a.ux + (py - a.y1) * a.uy;
      const [b1, b2] = [proj(b.x1, b.y1), proj(b.x2, b.y2)].sort((x, y) => x - y);
      return Math.min(a.len, b2) - Math.max(0, b1) > 20;
    };
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) if (overlap(geo[i], geo[j])) parent[find(j)] = find(i);
    }
    const groups = /* @__PURE__ */ new Map();
    geo.forEach((_, i) => {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(i);
    });
    const offsets = new Array(n).fill(0);
    for (const members of groups.values()) {
      if (members.length < 2) continue;
      members.sort((a, b) => geo[a].rank - geo[b].rank || geo[a].ply - geo[b].ply);
      members.forEach((m, k) => offsets[m] = (k - (members.length - 1) / 2) * GAP);
    }
    return offsets;
  }
  var Overlay = class {
    constructor() {
      this.svg = document.createElementNS(NS, "svg");
      this.svg.setAttribute("viewBox", "0 0 800 800");
      this.svg.setAttribute("aria-hidden", "true");
      Object.assign(this.svg.style, {
        position: "fixed",
        pointerEvents: "none",
        zIndex: "2147483000",
        display: "none"
      });
      document.documentElement.appendChild(this.svg);
    }
    place(rect) {
      if (!rect || rect.width < 50) {
        this.svg.style.display = "none";
        return;
      }
      Object.assign(this.svg.style, {
        display: "block",
        left: rect.left + "px",
        top: rect.top + "px",
        width: rect.width + "px",
        height: rect.height + "px"
      });
    }
    // arrows: [{ from, to, rank, ply, n }] – ply > 0 to cienkie strzałki kolejnych ruchów, n to numer w kółku (showOrder).
    draw(arrows, orientation, showOrder = false, colors = DEFAULT_COLORS) {
      arrows = arrows.filter((a) => a.ply === 0).slice(0, 1);
      const signature = JSON.stringify([arrows, orientation, showOrder, colors]);
      if (signature === this.signature) return;
      this.signature = signature;
      this.colors = colors;
      this.svg.replaceChildren();
      const geo = [];
      for (const a of arrows) {
        const [x1, y1] = center(a.from, orientation);
        const [x2, y2] = center(a.to, orientation);
        const len = Math.hypot(x2 - x1, y2 - y1);
        if (!len) continue;
        geo.push({ ...a, x1, y1, x2, y2, len, ux: (x2 - x1) / len, uy: (y2 - y1) / len });
      }
      const offsets = spreadOffsets(geo);
      geo.forEach((g, i) => {
        const flip = g.ux < 0 || Math.abs(g.ux) < 1e-9 && g.uy < 0 ? -1 : 1;
        const nx = -g.uy * flip;
        const ny = g.ux * flip;
        g.x1 += nx * offsets[i];
        g.x2 += nx * offsets[i];
        g.y1 += ny * offsets[i];
        g.y2 += ny * offsets[i];
      });
      const order = geo.sort((a, b) => (b.ply > 0) - (a.ply > 0) || b.rank - a.rank || b.ply - a.ply);
      for (const a of order) {
        const { x1, y1, x2, y2, ux, uy } = a;
        const follow = a.ply > 0;
        const best = a.rank === 0 && !follow;
        const width = follow ? 5 : best ? 18 : 11;
        const head = follow ? 24 : best ? 44 : 32;
        const sx = x1 + ux * 18;
        const sy = y1 + uy * 18;
        const bx = x2 - ux * head * 0.8;
        const by = y2 - uy * head * 0.8;
        const color = this.colors[a.rank % this.colors.length];
        const g = document.createElementNS(NS, "g");
        g.setAttribute("opacity", follow ? "0.75" : best ? "0.85" : "0.6");
        g.setAttribute("fill", color);
        g.setAttribute("stroke", color);
        const line = document.createElementNS(NS, "line");
        line.setAttribute("x1", sx);
        line.setAttribute("y1", sy);
        line.setAttribute("x2", bx);
        line.setAttribute("y2", by);
        line.setAttribute("stroke-width", width);
        line.setAttribute("stroke-linecap", "round");
        const tri = document.createElementNS(NS, "polygon");
        const px = -uy;
        const py = ux;
        const hw = head * 0.55;
        tri.setAttribute(
          "points",
          `${x2 - ux * 6},${y2 - uy * 6} ${bx + px * hw},${by + py * hw} ${bx - px * hw},${by - py * hw}`
        );
        tri.setAttribute("stroke", "none");
        g.append(line, tri);
        this.svg.appendChild(g);
      }
      if (showOrder) for (const a of order) this.svg.appendChild(this.badge(a));
    }
    badge(a) {
      const head = a.ply > 0 ? 24 : a.rank === 0 ? 44 : 32;
      const mx = (a.x1 + a.ux * 18 + a.x2 - a.ux * head * 0.8) / 2;
      const my = (a.y1 + a.uy * 18 + a.y2 - a.uy * head * 0.8) / 2;
      const big = a.rank === 0;
      const r = big ? 16 : 11;
      const color = this.colors[a.rank % this.colors.length];
      const g = document.createElementNS(NS, "g");
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", mx);
      c.setAttribute("cy", my);
      c.setAttribute("r", r);
      c.setAttribute("fill", "#fff");
      c.setAttribute("stroke", color);
      c.setAttribute("stroke-width", big ? 3 : 2);
      const tx = document.createElementNS(NS, "text");
      tx.setAttribute("x", mx);
      tx.setAttribute("y", my);
      tx.setAttribute("text-anchor", "middle");
      tx.setAttribute("dominant-baseline", "central");
      tx.setAttribute("font-family", "system-ui, sans-serif");
      tx.setAttribute("font-weight", "700");
      tx.setAttribute("font-size", big ? 21 : 14);
      tx.setAttribute("fill", "#111");
      tx.textContent = String(a.n);
      g.append(c, tx);
      return g;
    }
    clear() {
      if (!this.svg.childNodes.length) return;
      this.signature = null;
      this.svg.replaceChildren();
    }
    destroy() {
      this.svg.remove();
    }
  };

  // src/content/i18n.js
  var LANGS = { en: "English", ar: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", pl: "Polski", es: "Espa\xF1ol", de: "Deutsch" };
  var DICT = {
    en: {
      title: "Chess Helper",
      "panel.subtitle": "Local engine \xB7 practice & analysis",
      "panel.settings": "Panel settings",
      "power.title": "Turn analysis on / off",
      "fold.title": "Collapse / expand",
      "fold.expand": "Expand panel",
      "fold.collapse": "Collapse panel",
      fairplay: "For local study and practice against built-in bots. Do not use engine assistance against people. Page detection cannot reliably identify bots.",
      "fairplay.ok": "I understand",
      "live.warn": "This page may be a game against another person. Analysis has been turned off. Page detection cannot reliably identify bots. Use only local study or built-in bots.",
      "status.liveOff": "Analysis off",
      on: "On",
      off: "Off",
      hint: "\u{1F4A1} Hint",
      settings: "Settings",
      lines: "Number of lines",
      depth: "Analysis depth",
      turn: "Side to move",
      "turn.auto": "auto",
      "side.w": "White",
      "side.b": "Black",
      arrows: "Arrows on the board",
      "arrow.note": "One selected candidate is highlighted. Full variations remain in the list.",
      colors: "Line colors",
      "color.label": "Line {n} color",
      "score.note": "Scores favor White when positive. Mate scores are separate.",
      "colors.reset": "Restore default colors",
      showOrder: "Number the arrows (move order)",
      followMine: "Arrows: my next moves",
      followOpp: "Arrows: opponent replies",
      onlyBottom: "Bottom side only",
      "group.analysis": "Analysis",
      "group.arrows": "Arrows",
      "group.general": "General",
      "acc.title": "Accuracy",
      "acc.last": "last",
      "acc.avg": "avg.",
      "acc.moves": "{n} moves",
      showAccuracy: "Show move accuracy",
      opacity: "Window opacity",
      "info.title": "How the pieces move",
      "piece.k": "King",
      "info.k": "One square in any direction. Castling: the king moves two squares towards a rook and the rook jumps over it (neither may have moved before; the king must not pass through check).",
      "piece.q": "Queen",
      "info.q": "Any number of squares horizontally, vertically or diagonally.",
      "piece.r": "Rook",
      "info.r": "Any number of squares horizontally or vertically.",
      "piece.b": "Bishop",
      "info.b": "Any number of squares diagonally (always stays on the same colour).",
      "piece.n": "Knight",
      "info.n": "An \u201CL\u201D: two squares in one direction and one at a right angle. The only piece that jumps over others.",
      "piece.p": "Pawn",
      "info.p": "Forward one square (two from its starting square); captures one square diagonally forward. Special: en passant, promotion on the last rank.",
      "acc.win": "win",
      "acc.win.title": "Chance of winning in the current position (engine estimate)",
      language: "Language",
      reset: "Restore factory settings",
      "reset.confirm": "Click again to confirm",
      engineNote: "Engine: Stockfish 19 (lite), runs locally in your browser.",
      depthLabel: "depth {n}",
      "status.searching": "Looking for a board\u2026",
      "status.detected": "Board detected ({site})",
      "status.noBoard": "No board detected. Open local analysis or a built-in bot game.",
      "status.off": "Analysis off",
      "status.turn": "{site} \xB7 to move: {side}",
      "status.turnAssumed": "{site} \xB7 to move: {side} (assumed \u2013 change in settings)",
      "status.opponent": "Opponent's move ({side})\u2026",
      "status.mate": "Checkmate \u2013 game over",
      "status.draw": "Draw \u2013 game over",
      "status.noPosition": "No valid position found on the board",
      "err.kings": "Both kings must be on the board",
      "err.pawn": "Pawn on the first or last rank",
      "err.parse": "Could not interpret the position",
      "err.impossible": "Impossible position (the side not to move is in check)"
    },
    ar: {
      title: "\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0634\u0637\u0631\u0646\u062C",
      "panel.subtitle": "\u0645\u062D\u0631\u0643 \u0645\u062D\u0644\u064A \xB7 \u062A\u062F\u0631\u064A\u0628 \u0648\u062A\u062D\u0644\u064A\u0644",
      "panel.settings": "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0644\u0648\u062D\u0629",
      "power.title": "\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0623\u0648 \u0625\u064A\u0642\u0627\u0641\u0647",
      "fold.title": "\u0637\u064A \u0627\u0644\u0644\u0648\u062D\u0629 \u0623\u0648 \u062A\u0648\u0633\u064A\u0639\u0647\u0627",
      "fold.expand": "\u062A\u0648\u0633\u064A\u0639 \u0627\u0644\u0644\u0648\u062D\u0629",
      "fold.collapse": "\u0637\u064A \u0627\u0644\u0644\u0648\u062D\u0629",
      fairplay: "\u0644\u0644\u062F\u0631\u0627\u0633\u0629 \u0627\u0644\u0645\u062D\u0644\u064A\u0629 \u0648\u0627\u0644\u062A\u062F\u0631\u064A\u0628 \u0645\u0639 \u0627\u0644\u0631\u0648\u0628\u0648\u062A\u0627\u062A \u0627\u0644\u0645\u062F\u0645\u062C\u0629. \u0644\u0627 \u062A\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u0627\u0639\u062F\u0629 \u0627\u0644\u0645\u062D\u0631\u0643 \u0636\u062F \u0623\u0634\u062E\u0627\u0635. \u0644\u0627 \u064A\u0645\u0643\u0646 \u0644\u0627\u0643\u062A\u0634\u0627\u0641 \u0627\u0644\u0635\u0641\u062D\u0629 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0631\u0648\u0628\u0648\u062A\u0627\u062A \u0628\u0634\u0643\u0644 \u0645\u0648\u062B\u0648\u0642.",
      "fairplay.ok": "\u0641\u0647\u0645\u062A",
      "live.warn": "\u0642\u062F \u062A\u0643\u0648\u0646 \u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062D\u0629 \u0645\u0628\u0627\u0631\u0627\u0629 \u0636\u062F \u0634\u062E\u0635 \u0622\u062E\u0631. \u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u062A\u062D\u0644\u064A\u0644. \u0644\u0627 \u064A\u0645\u0643\u0646 \u0644\u0627\u0643\u062A\u0634\u0627\u0641 \u0627\u0644\u0635\u0641\u062D\u0629 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0631\u0648\u0628\u0648\u062A\u0627\u062A \u0628\u0634\u0643\u0644 \u0645\u0648\u062B\u0648\u0642. \u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0623\u062F\u0627\u0629 \u0644\u0644\u062F\u0631\u0627\u0633\u0629 \u0627\u0644\u0645\u062D\u0644\u064A\u0629 \u0623\u0648 \u0645\u0639 \u0627\u0644\u0631\u0648\u0628\u0648\u062A\u0627\u062A \u0627\u0644\u0645\u062F\u0645\u062C\u0629 \u0641\u0642\u0637.",
      "status.liveOff": "\u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0645\u062A\u0648\u0642\u0641",
      on: "\u0645\u0641\u0639\u0651\u0644",
      off: "\u0645\u062A\u0648\u0642\u0641",
      hint: "\u062A\u0644\u0645\u064A\u062D",
      settings: "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A",
      lines: "\u0639\u062F\u062F \u062E\u0637\u0648\u0637 \u0627\u0644\u0644\u0639\u0628",
      depth: "\u0639\u0645\u0642 \u0627\u0644\u062A\u062D\u0644\u064A\u0644",
      turn: "\u0635\u0627\u062D\u0628 \u0627\u0644\u062F\u0648\u0631",
      "turn.auto": "\u062A\u0644\u0642\u0627\u0626\u064A",
      "side.w": "\u0627\u0644\u0623\u0628\u064A\u0636",
      "side.b": "\u0627\u0644\u0623\u0633\u0648\u062F",
      arrows: "\u0627\u0644\u0623\u0633\u0647\u0645 \u0639\u0644\u0649 \u0627\u0644\u0631\u0642\u0639\u0629",
      "arrow.note": "\u062A\u064F\u0645\u064A\u0651\u0632 \u0646\u0642\u0644\u0629 \u0645\u0631\u0634\u062D\u0629 \u0648\u0627\u062D\u062F\u0629 \u0645\u062D\u062F\u062F\u0629. \u062A\u0628\u0642\u0649 \u062E\u0637\u0648\u0637 \u0627\u0644\u0644\u0639\u0628 \u0643\u0627\u0645\u0644\u0629 \u0641\u064A \u0627\u0644\u0642\u0627\u0626\u0645\u0629.",
      colors: "\u0623\u0644\u0648\u0627\u0646 \u062E\u0637\u0648\u0637 \u0627\u0644\u0644\u0639\u0628",
      "color.label": "\u0644\u0648\u0646 \u062E\u0637 \u0627\u0644\u0644\u0639\u0628 {n}",
      "score.note": "\u0627\u0644\u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0645\u0648\u062C\u0628 \u0644\u0635\u0627\u0644\u062D \u0627\u0644\u0623\u0628\u064A\u0636. \u062A\u0642\u064A\u064A\u0645\u0627\u062A \u0643\u0634 \u0645\u0627\u062A \u0645\u0646\u0641\u0635\u0644\u0629.",
      "colors.reset": "\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0623\u0644\u0648\u0627\u0646 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629",
      showOrder: "\u062A\u0631\u0642\u064A\u0645 \u0627\u0644\u0623\u0633\u0647\u0645 \u062D\u0633\u0628 \u062A\u0631\u062A\u064A\u0628 \u0627\u0644\u0646\u0642\u0644\u0627\u062A",
      followMine: "\u0627\u0644\u0623\u0633\u0647\u0645: \u0646\u0642\u0644\u0627\u062A\u064A \u0627\u0644\u062A\u0627\u0644\u064A\u0629",
      followOpp: "\u0627\u0644\u0623\u0633\u0647\u0645: \u0631\u062F\u0648\u062F \u0627\u0644\u062E\u0635\u0645",
      onlyBottom: "\u0627\u0644\u0637\u0631\u0641 \u0623\u0633\u0641\u0644 \u0627\u0644\u0631\u0642\u0639\u0629 \u0641\u0642\u0637",
      "group.analysis": "\u0627\u0644\u062A\u062D\u0644\u064A\u0644",
      "group.arrows": "\u0627\u0644\u0623\u0633\u0647\u0645",
      "group.general": "\u0639\u0627\u0645",
      "acc.title": "\u0627\u0644\u062F\u0642\u0629",
      "acc.last": "\u0627\u0644\u0623\u062E\u064A\u0631\u0629",
      "acc.avg": "\u0627\u0644\u0645\u062A\u0648\u0633\u0637",
      "acc.moves": "{n} \u0646\u0642\u0644\u0627\u062A",
      showAccuracy: "\u0625\u0638\u0647\u0627\u0631 \u062F\u0642\u0629 \u0627\u0644\u0646\u0642\u0644\u0627\u062A",
      opacity: "\u0639\u062A\u0627\u0645\u0629 \u0627\u0644\u0646\u0627\u0641\u0630\u0629",
      "info.title": "\u0643\u064A\u0641 \u062A\u062A\u062D\u0631\u0643 \u0627\u0644\u0642\u0637\u0639",
      "piece.k": "\u0627\u0644\u0645\u0644\u0643",
      "info.k": "\u0645\u0631\u0628\u0639 \u0648\u0627\u062D\u062F \u0641\u064A \u0623\u064A \u0627\u062A\u062C\u0627\u0647. \u0641\u064A \u0627\u0644\u062A\u0628\u064A\u064A\u062A \u064A\u062A\u062D\u0631\u0643 \u0627\u0644\u0645\u0644\u0643 \u0645\u0631\u0628\u0639\u064A\u0646 \u0646\u062D\u0648 \u0627\u0644\u0631\u062E\u060C \u0648\u064A\u0646\u062A\u0642\u0644 \u0627\u0644\u0631\u062E \u0625\u0644\u0649 \u0627\u0644\u062C\u0627\u0646\u0628 \u0627\u0644\u0622\u062E\u0631 \u0645\u0646\u0647. \u064A\u0634\u062A\u0631\u0637 \u0623\u0644\u0627 \u064A\u0643\u0648\u0646 \u0623\u064A \u0645\u0646\u0647\u0645\u0627 \u0642\u062F \u062A\u062D\u0631\u0643\u060C \u0648\u0623\u0644\u0627 \u064A\u0643\u0648\u0646 \u0627\u0644\u0645\u0644\u0643 \u0641\u064A \u0643\u0634 \u0623\u0648 \u064A\u0645\u0631 \u0628\u0645\u0631\u0628\u0639 \u0645\u0647\u062F\u062F \u0623\u0648 \u064A\u0635\u0644 \u0625\u0644\u064A\u0647.",
      "piece.q": "\u0627\u0644\u0648\u0632\u064A\u0631",
      "info.q": "\u0623\u064A \u0639\u062F\u062F \u0645\u0646 \u0627\u0644\u0645\u0631\u0628\u0639\u0627\u062A \u0623\u0641\u0642\u064A\u064B\u0627 \u0623\u0648 \u0639\u0645\u0648\u062F\u064A\u064B\u0627 \u0623\u0648 \u0642\u0637\u0631\u064A\u064B\u0627.",
      "piece.r": "\u0627\u0644\u0631\u062E",
      "info.r": "\u0623\u064A \u0639\u062F\u062F \u0645\u0646 \u0627\u0644\u0645\u0631\u0628\u0639\u0627\u062A \u0623\u0641\u0642\u064A\u064B\u0627 \u0623\u0648 \u0639\u0645\u0648\u062F\u064A\u064B\u0627.",
      "piece.b": "\u0627\u0644\u0641\u064A\u0644",
      "info.b": "\u0623\u064A \u0639\u062F\u062F \u0645\u0646 \u0627\u0644\u0645\u0631\u0628\u0639\u0627\u062A \u0642\u0637\u0631\u064A\u064B\u0627\u060C \u0648\u064A\u0628\u0642\u0649 \u062F\u0627\u0626\u0645\u064B\u0627 \u0639\u0644\u0649 \u0644\u0648\u0646 \u0627\u0644\u0645\u0631\u0628\u0639\u0627\u062A \u0646\u0641\u0633\u0647.",
      "piece.n": "\u0627\u0644\u062D\u0635\u0627\u0646",
      "info.n": "\u0645\u0631\u0628\u0639\u0627\u0646 \u0641\u064A \u0627\u062A\u062C\u0627\u0647 \u062B\u0645 \u0645\u0631\u0628\u0639 \u0639\u0645\u0648\u062F\u064A \u0639\u0644\u064A\u0647. \u0647\u0648 \u0627\u0644\u0642\u0637\u0639\u0629 \u0627\u0644\u0648\u062D\u064A\u062F\u0629 \u0627\u0644\u062A\u064A \u062A\u0642\u0641\u0632 \u0641\u0648\u0642 \u0627\u0644\u0642\u0637\u0639 \u0627\u0644\u0623\u062E\u0631\u0649.",
      "piece.p": "\u0627\u0644\u0628\u064A\u062F\u0642",
      "info.p": "\u0645\u0631\u0628\u0639 \u0648\u0627\u062D\u062F \u0625\u0644\u0649 \u0627\u0644\u0623\u0645\u0627\u0645\u060C \u0623\u0648 \u0645\u0631\u0628\u0639\u0627\u0646 \u0645\u0646 \u0645\u0648\u0636\u0639 \u0627\u0644\u0628\u062F\u0627\u064A\u0629. \u064A\u0623\u062E\u0630 \u0642\u0637\u0639\u0629 \u0641\u064A \u0627\u0644\u0645\u0631\u0628\u0639 \u0627\u0644\u0642\u0637\u0631\u064A \u0627\u0644\u0623\u0645\u0627\u0645\u064A. \u0644\u0647 \u062D\u0631\u0643\u062A\u0627\u0646 \u062E\u0627\u0635\u062A\u0627\u0646: \u0627\u0644\u0623\u062E\u0630 \u0628\u0627\u0644\u062A\u062C\u0627\u0648\u0632 \u0648\u0627\u0644\u062A\u0631\u0642\u064A\u0629 \u0641\u064A \u0627\u0644\u0635\u0641 \u0627\u0644\u0623\u062E\u064A\u0631.",
      "acc.win": "\u0627\u0644\u0641\u0648\u0632",
      "acc.win.title": "\u0627\u062D\u062A\u0645\u0627\u0644 \u0627\u0644\u0641\u0648\u0632 \u0641\u064A \u0627\u0644\u0648\u0636\u0639\u064A\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629\u060C \u0648\u0641\u0642 \u062A\u0642\u062F\u064A\u0631 \u0627\u0644\u0645\u062D\u0631\u0643",
      language: "\u0644\u063A\u0629 \u0627\u0644\u0648\u0627\u062C\u0647\u0629",
      reset: "\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629",
      "reset.confirm": "\u0627\u0646\u0642\u0631 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649 \u0644\u0644\u062A\u0623\u0643\u064A\u062F",
      engineNote: "\u0627\u0644\u0645\u062D\u0631\u0643: Stockfish 19 (lite)\u060C \u064A\u0639\u0645\u0644 \u0645\u062D\u0644\u064A\u064B\u0627 \u0641\u064A \u0645\u062A\u0635\u0641\u062D\u0643.",
      depthLabel: "\u0627\u0644\u0639\u0645\u0642 {n}",
      "status.searching": "\u062C\u0627\u0631\u064D \u0627\u0644\u0628\u062D\u062B \u0639\u0646 \u0631\u0642\u0639\u0629\u2026",
      "status.detected": "\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0631\u0642\u0639\u0629 ({site})",
      "status.noBoard": "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0631\u0642\u0639\u0629. \u0627\u0641\u062A\u062D \u062A\u062D\u0644\u064A\u0644\u064B\u0627 \u0645\u062D\u0644\u064A\u064B\u0627 \u0623\u0648 \u0645\u0628\u0627\u0631\u0627\u0629 \u0645\u0639 \u0631\u0648\u0628\u0648\u062A \u0645\u062F\u0645\u062C.",
      "status.off": "\u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0645\u062A\u0648\u0642\u0641",
      "status.turn": "{site} \xB7 \u0627\u0644\u062F\u0648\u0631: {side}",
      "status.turnAssumed": "{site} \xB7 \u0627\u0644\u062F\u0648\u0631: {side} (\u062A\u0642\u062F\u064A\u0631\u064A\u060C \u0648\u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631\u0647 \u0641\u064A \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A)",
      "status.opponent": "\u062F\u0648\u0631 \u0627\u0644\u062E\u0635\u0645 ({side})\u2026",
      "status.mate": "\u0643\u0634 \u0645\u0627\u062A\u060C \u0627\u0646\u062A\u0647\u062A \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629",
      "status.draw": "\u062A\u0639\u0627\u062F\u0644\u060C \u0627\u0646\u062A\u0647\u062A \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629",
      "status.noPosition": "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0648\u0636\u0639\u064A\u0629 \u0635\u0627\u0644\u062D\u0629 \u0639\u0644\u0649 \u0627\u0644\u0631\u0642\u0639\u0629",
      "err.kings": "\u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0627\u0644\u0645\u0644\u0643\u0627\u0646 \u0639\u0644\u0649 \u0627\u0644\u0631\u0642\u0639\u0629",
      "err.pawn": "\u064A\u0648\u062C\u062F \u0628\u064A\u062F\u0642 \u0641\u064A \u0627\u0644\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 \u0623\u0648 \u0627\u0644\u0623\u062E\u064A\u0631",
      "err.parse": "\u062A\u0639\u0630\u0651\u0631\u062A \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0648\u0636\u0639\u064A\u0629",
      "err.impossible": "\u0648\u0636\u0639\u064A\u0629 \u0645\u0633\u062A\u062D\u064A\u0644\u0629: \u0627\u0644\u0645\u0644\u0643 \u0627\u0644\u0630\u064A \u0644\u064A\u0633 \u0644\u0647 \u0627\u0644\u062F\u0648\u0631 \u0641\u064A \u0643\u0634"
    },
    pl: {
      title: "Chess Helper",
      "panel.subtitle": "Lokalny silnik \xB7 trening i analiza",
      "panel.settings": "Ustawienia panelu",
      "power.title": "W\u0142\u0105cz / wy\u0142\u0105cz analiz\u0119",
      "fold.title": "Zwi\u0144 / rozwi\u0144",
      "fold.expand": "Rozwi\u0144 panel",
      "fold.collapse": "Zwi\u0144 panel",
      fairplay: "Do lokalnej nauki i treningu z wbudowanymi botami. Nie korzystaj z pomocy silnika przeciwko ludziom. Wykrywanie strony nie pozwala wiarygodnie rozpozna\u0107 bot\xF3w.",
      "fairplay.ok": "Rozumiem",
      "live.warn": "Ta strona mo\u017Ce przedstawia\u0107 parti\u0119 przeciwko innej osobie. Analiz\u0119 wy\u0142\u0105czono. Wykrywanie strony nie pozwala wiarygodnie rozpozna\u0107 bot\xF3w. U\u017Cywaj tylko do lokalnej nauki lub z wbudowanymi botami.",
      "status.liveOff": "Analiza wy\u0142\u0105czona",
      on: "W\u0142.",
      off: "Wy\u0142.",
      hint: "\u{1F4A1} Podpowied\u017A",
      settings: "Ustawienia",
      lines: "Liczba wariant\xF3w",
      depth: "G\u0142\u0119boko\u015B\u0107 analizy",
      turn: "Strona na ruchu",
      "turn.auto": "auto",
      "side.w": "bia\u0142e",
      "side.b": "czarne",
      arrows: "Strza\u0142ki na planszy",
      "arrow.note": "Wyr\xF3\u017Cniony jest jeden wybrany ruch. Pe\u0142ne warianty pozostaj\u0105 na li\u015Bcie.",
      colors: "Kolory wariant\xF3w",
      "color.label": "Kolor wariantu {n}",
      "score.note": "Dodatnia ocena sprzyja bia\u0142ym. Oceny mata s\u0105 oddzielne.",
      "colors.reset": "Przywr\xF3\u0107 domy\u015Blne kolory",
      showOrder: "Numeruj strza\u0142ki (kolejno\u015B\u0107 ruch\xF3w)",
      followMine: "Strza\u0142ki: moje kolejne ruchy",
      followOpp: "Strza\u0142ki: odpowiedzi przeciwnika",
      onlyBottom: "Tylko dla strony z do\u0142u",
      "group.analysis": "Analiza",
      "group.arrows": "Strza\u0142ki",
      "group.general": "Og\xF3lne",
      "acc.title": "Dok\u0142adno\u015B\u0107",
      "acc.last": "ostatni",
      "acc.avg": "\u015Brednia",
      "acc.moves": "ruch\xF3w: {n}",
      showAccuracy: "Poka\u017C dok\u0142adno\u015B\u0107 ruch\xF3w",
      opacity: "Nieprzezroczysto\u015B\u0107 okna",
      "info.title": "Jak poruszaj\u0105 si\u0119 figury",
      "piece.k": "Kr\xF3l",
      "info.k": "Jedno pole w dowolnym kierunku. Roszada: kr\xF3l idzie o dwa pola w stron\u0119 wie\u017Cy, a wie\u017Ca przeskakuje na drug\u0105 jego stron\u0119 (\u017Cadna z nich nie mog\u0142a si\u0119 wcze\u015Bniej ruszy\u0107, a kr\xF3l nie przechodzi przez szach).",
      "piece.q": "Hetman",
      "info.q": "Dowolna liczba p\xF3l w poziomie, w pionie lub po skosie.",
      "piece.r": "Wie\u017Ca",
      "info.r": "Dowolna liczba p\xF3l w poziomie lub w pionie.",
      "piece.b": "Goniec",
      "info.b": "Dowolna liczba p\xF3l po skosie (zawsze zostaje na polach jednego koloru).",
      "piece.n": "Skoczek",
      "info.n": "Ruch w kszta\u0142cie litery \u201EL\u201D: dwa pola w jednym kierunku i jedno prostopadle. Jako jedyny przeskakuje inne figury.",
      "piece.p": "Pion",
      "info.p": "Do przodu o jedno pole (z pola startowego o dwa), bije jedno pole po skosie do przodu. Specjalne: bicie w przelocie, promocja na ostatnim rz\u0119dzie.",
      "acc.win": "szanse",
      "acc.win.title": "Szanse na wygran\u0105 w bie\u017C\u0105cej pozycji (ocena silnika)",
      language: "J\u0119zyk",
      reset: "Przywr\xF3\u0107 ustawienia fabryczne",
      "reset.confirm": "Kliknij ponownie, by potwierdzi\u0107",
      engineNote: "Silnik: Stockfish 19 (lite), liczy lokalnie w przegl\u0105darce.",
      depthLabel: "g\u0142\u0119b. {n}",
      "status.searching": "Szukam planszy\u2026",
      "status.detected": "Wykryto plansz\u0119 ({site})",
      "status.noBoard": "Nie wykryto planszy. Otw\xF3rz lokaln\u0105 analiz\u0119 lub parti\u0119 z wbudowanym botem.",
      "status.off": "Analiza wy\u0142\u0105czona",
      "status.turn": "{site} \xB7 na ruchu: {side}",
      "status.turnAssumed": "{site} \xB7 na ruchu: {side} (za\u0142o\u017Cono \u2013 zmie\u0144 w ustawieniach)",
      "status.opponent": "Ruch przeciwnika ({side})\u2026",
      "status.mate": "Mat \u2013 partia zako\u0144czona",
      "status.draw": "Remis \u2013 partia zako\u0144czona",
      "status.noPosition": "Nie wykryto poprawnej pozycji na planszy",
      "err.kings": "Na planszy brak obu kr\xF3l\xF3w",
      "err.pawn": "Pion na skrajnym rz\u0119dzie",
      "err.parse": "Nie uda\u0142o si\u0119 zinterpretowa\u0107 pozycji",
      "err.impossible": "Niemo\u017Cliwa pozycja (szach dla strony, kt\xF3ra nie ma ruchu)"
    },
    es: {
      title: "Chess Helper",
      "panel.subtitle": "Motor local \xB7 pr\xE1ctica y an\xE1lisis",
      "panel.settings": "Ajustes del panel",
      "power.title": "Activar / desactivar el an\xE1lisis",
      "fold.title": "Contraer / expandir",
      "fold.expand": "Expandir panel",
      "fold.collapse": "Contraer panel",
      fairplay: "Para estudiar localmente y practicar contra bots integrados. No uses la ayuda del motor contra personas. La detecci\xF3n de p\xE1ginas no puede identificar bots de forma fiable.",
      "fairplay.ok": "Entendido",
      "live.warn": "Esta p\xE1gina podr\xEDa ser una partida contra otra persona. Se desactiv\xF3 el an\xE1lisis. La detecci\xF3n de p\xE1ginas no puede identificar bots de forma fiable. \xDAsalo solo para estudio local o con bots integrados.",
      "status.liveOff": "An\xE1lisis desactivado",
      on: "Act.",
      off: "Desact.",
      hint: "\u{1F4A1} Pista",
      settings: "Ajustes",
      lines: "N\xFAmero de variantes",
      depth: "Profundidad de an\xE1lisis",
      turn: "Bando que mueve",
      "turn.auto": "auto",
      "side.w": "blancas",
      "side.b": "negras",
      arrows: "Flechas en el tablero",
      "arrow.note": "Se destaca una jugada candidata seleccionada. Las variantes completas permanecen en la lista.",
      colors: "Colores de las variantes",
      "color.label": "Color de la variante {n}",
      "score.note": "Las puntuaciones positivas favorecen a las blancas. Las de mate se muestran por separado.",
      "colors.reset": "Restaurar colores por defecto",
      showOrder: "Numerar las flechas (orden de jugadas)",
      followMine: "Flechas: mis siguientes jugadas",
      followOpp: "Flechas: respuestas del rival",
      onlyBottom: "Solo el bando de abajo",
      "group.analysis": "An\xE1lisis",
      "group.arrows": "Flechas",
      "group.general": "General",
      "acc.title": "Precisi\xF3n",
      "acc.last": "\xFAltimo",
      "acc.avg": "media",
      "acc.moves": "{n} jugadas",
      showAccuracy: "Mostrar precisi\xF3n de las jugadas",
      opacity: "Opacidad de la ventana",
      "info.title": "C\xF3mo se mueven las piezas",
      "piece.k": "Rey",
      "info.k": "Una casilla en cualquier direcci\xF3n. Enroque: el rey se mueve dos casillas hacia una torre y la torre salta al otro lado (ninguno debe haberse movido antes y el rey no puede pasar por jaque).",
      "piece.q": "Dama",
      "info.q": "Cualquier n\xFAmero de casillas en horizontal, vertical o diagonal.",
      "piece.r": "Torre",
      "info.r": "Cualquier n\xFAmero de casillas en horizontal o vertical.",
      "piece.b": "Alfil",
      "info.b": "Cualquier n\xFAmero de casillas en diagonal (siempre permanece en casillas del mismo color).",
      "piece.n": "Caballo",
      "info.n": "En forma de \xABL\xBB: dos casillas en una direcci\xF3n y una en perpendicular. Es la \xFAnica pieza que salta sobre otras.",
      "piece.p": "Pe\xF3n",
      "info.p": "Avanza una casilla (dos desde su casilla inicial) y captura una casilla en diagonal hacia delante. Especiales: captura al paso y coronaci\xF3n en la \xFAltima fila.",
      "acc.win": "victoria",
      "acc.win.title": "Probabilidad de ganar en la posici\xF3n actual (estimaci\xF3n del motor)",
      language: "Idioma",
      reset: "Restaurar ajustes de f\xE1brica",
      "reset.confirm": "Pulsa de nuevo para confirmar",
      engineNote: "Motor: Stockfish 19 (lite), se ejecuta localmente en tu navegador.",
      depthLabel: "prof. {n}",
      "status.searching": "Buscando un tablero\u2026",
      "status.detected": "Tablero detectado ({site})",
      "status.noBoard": "No se detecta ning\xFAn tablero. Abre un an\xE1lisis local o una partida contra un bot integrado.",
      "status.off": "An\xE1lisis desactivado",
      "status.turn": "{site} \xB7 mueve: {side}",
      "status.turnAssumed": "{site} \xB7 mueve: {side} (supuesto: c\xE1mbialo en los ajustes)",
      "status.opponent": "Jugada del rival ({side})\u2026",
      "status.mate": "Jaque mate: partida terminada",
      "status.draw": "Tablas: partida terminada",
      "status.noPosition": "No se encontr\xF3 una posici\xF3n v\xE1lida en el tablero",
      "err.kings": "Ambos reyes deben estar en el tablero",
      "err.pawn": "Pe\xF3n en la primera o la \xFAltima fila",
      "err.parse": "No se pudo interpretar la posici\xF3n",
      "err.impossible": "Posici\xF3n imposible (el bando que no mueve est\xE1 en jaque)"
    },
    de: {
      title: "Chess Helper",
      "panel.subtitle": "Lokale Engine \xB7 Training und Analyse",
      "panel.settings": "Panel-Einstellungen",
      "power.title": "Analyse ein- / ausschalten",
      "fold.title": "Einklappen / ausklappen",
      "fold.expand": "Panel ausklappen",
      "fold.collapse": "Panel einklappen",
      fairplay: "F\xFCr lokales Lernen und Training gegen integrierte Bots. Verwende keine Engine-Hilfe gegen Menschen. Die Seitenerkennung kann Bots nicht zuverl\xE4ssig identifizieren.",
      "fairplay.ok": "Verstanden",
      "live.warn": "Diese Seite k\xF6nnte eine Partie gegen einen Menschen zeigen. Die Analyse wurde ausgeschaltet. Die Seitenerkennung kann Bots nicht zuverl\xE4ssig identifizieren. Nur f\xFCr lokales Lernen oder integrierte Bots verwenden.",
      "status.liveOff": "Analyse aus",
      on: "Ein",
      off: "Aus",
      hint: "\u{1F4A1} Tipp",
      settings: "Einstellungen",
      lines: "Anzahl der Varianten",
      depth: "Analysetiefe",
      turn: "Am Zug",
      "turn.auto": "auto",
      "side.w": "Wei\xDF",
      "side.b": "Schwarz",
      arrows: "Pfeile auf dem Brett",
      "arrow.note": "Ein ausgew\xE4hlter Kandidatenzug wird hervorgehoben. Vollst\xE4ndige Varianten bleiben in der Liste.",
      colors: "Farben der Varianten",
      "color.label": "Farbe der Variante {n}",
      "score.note": "Positive Bewertungen sprechen f\xFCr Wei\xDF. Mattbewertungen werden getrennt angezeigt.",
      "colors.reset": "Standardfarben wiederherstellen",
      showOrder: "Pfeile nummerieren (Zugreihenfolge)",
      followMine: "Pfeile: meine n\xE4chsten Z\xFCge",
      followOpp: "Pfeile: Antworten des Gegners",
      onlyBottom: "Nur Seite unten",
      "group.analysis": "Analyse",
      "group.arrows": "Pfeile",
      "group.general": "Allgemein",
      "acc.title": "Genauigkeit",
      "acc.last": "letzter",
      "acc.avg": "\xD8",
      "acc.moves": "{n} Z\xFCge",
      showAccuracy: "Zuggenauigkeit anzeigen",
      opacity: "Deckkraft des Fensters",
      "info.title": "So ziehen die Figuren",
      "piece.k": "K\xF6nig",
      "info.k": "Ein Feld in jede Richtung. Rochade: Der K\xF6nig zieht zwei Felder zu einem Turm, der Turm springt auf die andere Seite (beide d\xFCrfen vorher nicht gezogen haben, der K\xF6nig darf nicht durch ein Schachgebot ziehen).",
      "piece.q": "Dame",
      "info.q": "Beliebig viele Felder waagerecht, senkrecht oder diagonal.",
      "piece.r": "Turm",
      "info.r": "Beliebig viele Felder waagerecht oder senkrecht.",
      "piece.b": "L\xE4ufer",
      "info.b": "Beliebig viele Felder diagonal (bleibt immer auf Feldern einer Farbe).",
      "piece.n": "Springer",
      "info.n": "In \u201EL\u201C-Form: zwei Felder in eine Richtung und eines im rechten Winkel. Die einzige Figur, die \xFCber andere springt.",
      "piece.p": "Bauer",
      "info.p": "Ein Feld vorw\xE4rts (vom Startfeld zwei), schl\xE4gt ein Feld diagonal vorw\xE4rts. Besonders: en passant, Umwandlung auf der letzten Reihe.",
      "acc.win": "Gewinn",
      "acc.win.title": "Gewinnchance in der aktuellen Stellung (Einsch\xE4tzung der Engine)",
      language: "Sprache",
      reset: "Werkseinstellungen wiederherstellen",
      "reset.confirm": "Zum Best\xE4tigen erneut klicken",
      engineNote: "Engine: Stockfish 19 (lite), l\xE4uft lokal in deinem Browser.",
      depthLabel: "Tiefe {n}",
      "status.searching": "Suche ein Brett\u2026",
      "status.detected": "Brett erkannt ({site})",
      "status.noBoard": "Kein Brett erkannt. \xD6ffne eine lokale Analyse oder eine Partie gegen einen integrierten Bot.",
      "status.off": "Analyse aus",
      "status.turn": "{site} \xB7 am Zug: {side}",
      "status.turnAssumed": "{site} \xB7 am Zug: {side} (angenommen \u2013 in den Einstellungen \xE4nderbar)",
      "status.opponent": "Zug des Gegners ({side})\u2026",
      "status.mate": "Schachmatt \u2013 Partie beendet",
      "status.draw": "Remis \u2013 Partie beendet",
      "status.noPosition": "Keine g\xFCltige Stellung auf dem Brett gefunden",
      "err.kings": "Beide K\xF6nige m\xFCssen auf dem Brett stehen",
      "err.pawn": "Bauer auf der ersten oder letzten Reihe",
      "err.parse": "Die Stellung konnte nicht gelesen werden",
      "err.impossible": "Unm\xF6gliche Stellung (die Seite, die nicht am Zug ist, steht im Schach)"
    }
  };
  var lang = "en";
  function detectLang() {
    let ui = "en";
    try {
      ui = chrome.i18n.getUILanguage() || navigator.language || "en";
    } catch (_) {
      ui = navigator.language || "en";
    }
    const code = ui.slice(0, 2).toLowerCase();
    return DICT[code] ? code : "en";
  }
  function setLang(l) {
    if (DICT[l]) lang = l;
  }
  var getLang = () => lang;
  function t(key, params) {
    let s = (DICT[lang] && DICT[lang][key]) ?? DICT.en[key] ?? key;
    if (params) {
      s = s.replace(/\{(\w+)\}/g, (_, name) => {
        const v = params[name];
        return v && typeof v === "object" ? t(v.k) : String(v ?? "");
      });
    }
    return s;
  }

  // src/content/format.js
  function formatScore({ cp, mate }) {
    if (mate !== void 0) return mate === 0 ? "#" : (mate > 0 ? "#" : "-#") + Math.abs(mate);
    const v = (cp / 100).toFixed(2);
    return cp > 0 ? "+" + v : v;
  }
  function whitePercent({ cp, mate }) {
    if (mate !== void 0) return mate > 0 ? 100 : mate < 0 ? 0 : 50;
    return 50 + 50 * (2 / (1 + Math.exp(-368208e-8 * cp)) - 1);
  }
  function pvToSan(fen, pv, maxPlies = 11) {
    let chess;
    try {
      chess = new Chess(fen);
    } catch (_) {
      return { moves: [], text: "" };
    }
    const moves = [];
    for (const uci of pv.slice(0, maxPlies)) {
      let m;
      try {
        m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      } catch (_) {
        break;
      }
      moves.push({ san: m.san, uci, from: uci.slice(0, 2), to: uci.slice(2, 4) });
    }
    return { moves, text: moves.map((m) => m.san).join(" ") };
  }
  var SHOWN_PLIES = 6;
  var COUNT_CAP = 10;
  function summarizeLine(moves, turn = "w") {
    const san = moves.map((m) => m.san);
    return {
      items: san.slice(0, SHOWN_PLIES).map((s, i) => ({ san: s, white: turn === "w" === (i % 2 === 0) })),
      text: san.slice(0, SHOWN_PLIES).join(" "),
      fullText: san.slice(0, COUNT_CAP).join(" "),
      count: san.length > COUNT_CAP ? `${COUNT_CAP}+` : String(san.length)
    };
  }
  var FIGURINES = {
    true: { K: "\u2654", Q: "\u2655", R: "\u2656", B: "\u2657", N: "\u2658" },
    false: { K: "\u265A", Q: "\u265B", R: "\u265C", B: "\u265D", N: "\u265E" }
  };
  var TEXT_STYLE = "\uFE0E";
  function figurine(san, white) {
    const set = FIGURINES[white];
    const promo = (s) => s.replace(/=([QRBN])/, (_, p) => "=" + set[p] + TEXT_STYLE);
    if (/^[KQRBN]/.test(san)) return { icon: set[san[0]] + TEXT_STYLE, rest: promo(san.slice(1)) };
    return { icon: "", rest: promo(san) };
  }

  // src/content/panel.js
  var TEMPLATE = `
<style>
  :host { all: initial; unicode-bidi: isolate; }
  .box, .box * { box-sizing: border-box; }
  .box { container: chess-panel / inline-size; display: flex; flex-direction: column; position: fixed; z-index: 2147483001;
    inline-size: 380px; min-inline-size: min(320px, calc(100vw - 16px)); max-inline-size: calc(100vw - 16px);
    font: 14px/1.55 "Segoe UI", Tahoma, Arial, sans-serif; color: #192b29; background: #f5f3ec; color-scheme: only light;
    border: 1px solid #9caaa1; border-radius: 14px; box-shadow: 0 10px 36px #192b292e; text-align: start; unicode-bidi: isolate; overflow: hidden; }
  .panel-header { display: grid; grid-template-columns: minmax(0,1fr) repeat(3,48px); align-items: center; gap: 6px; padding: 12px 14px 8px; cursor: move; touch-action: none; flex: none; }
  .panel-header .title { font-size: 17px; line-height: 1.25; font-weight: 700; color: #17534a; min-inline-size: 0; }
  .panel-header .brand-icon { font-size: 25px; vertical-align: -2px; margin-inline-end: 3px; }
  :where(.panel-header,.panel-intro,.fair,.panel-settings) button, .hint-btn { min-block-size: 48px; min-inline-size: 48px; padding: 9px 12px; font: 16px/1.4 "Segoe UI",Tahoma,Arial,sans-serif; color: #192b29; background: #fffefb; border: 1px solid #788781; border-radius: 7px; cursor: pointer; }
  :where(.panel-header,.panel-intro,.fair,.panel-settings) button:hover, .hint-btn:hover { background: #e7eee3; }
  :where(.panel-header,.panel-intro,.fair,.panel-settings) :is(button,input,select,summary):focus-visible, .hint-btn:focus-visible { outline: 3px solid #073a8c; outline-offset: 3px; }
  .panel-header button { padding-inline: 4px; font-size: 14px; font-weight: 650; }
  .panel-header .power { color: #17534a; background: #e3ece0; border-color: #17534a; }
  .panel-header .power.off { color: #822b20; background: #fff1e9; border-color: #9b392d; }
  .panel-header .fold { font-size: 23px; font-weight: 400; }
  .panel-intro { display: flex; align-items: center; gap: 12px; padding: 0 14px 12px; border-block-end: 1px solid #d3d9d0; flex: none; }
  .panel-subtitle { margin: 0; color: #556460; font-size: 12px; flex: 1; }
  .panel-intro .settings-jump { font-size: 13px; color: #17534a; font-weight: 650; }
  .fair { display: flex; flex-direction: column; align-items: stretch; gap: 8px; padding: 12px 16px; background: #f6eed6; border-block-end: 1px solid #bfae77; color: #624c17; font-size: 13px; flex: none; }
  .fair button { align-self: flex-start; color: #624c17; border-color: #8e7840; background: #fffaf0; }
  .live { padding: 12px 16px; background: #fff1e9; border-block-end: 1px solid #c38c77; color: #822b20; font-size: 13px; flex: none; }
  .box > .foot { flex: none; padding: 10px 16px; border-block-start: 1px solid #d3d9d0; color: #556460; background: #f5f3ec; font-size: 12px; }
  .box > .body { padding: 16px; overflow-y: auto; min-block-size: 0; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #788781 #f5f3ec; }
  .box.collapsed > .body { display: none; }
  .body > .status { color: #556460; font-size: 13px; min-block-size: 20px; }
  .body > .status.err { color: #822b20; }
  .best { display: flex; flex-wrap: wrap; align-items: baseline; gap: 9px; margin-block: 10px 7px; }
  .best .san { font-size: 32px; font-weight: 700; line-height: 1.2; color: #17534a; }
  .best .score { font-size: 18px; font-weight: 650; }
  .best .depth { margin-inline-start: auto; color: #556460; font-size: 12px; }
  .best :is(.san,.score), .line, .line :is(.s,.t,.n), .opacity .pct, .acc .v { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
  .bar { block-size: 8px; background: #192b29; border: 1px solid #788781; border-radius: 5px; overflow: hidden; direction: ltr; }
  .bar > div { block-size: 100%; width: 50%; background: #fffefb; }
  .score-note { margin: 7px 0 10px; color: #556460; font-size: 12px; }
  .lines { display: grid; grid-template-columns: minmax(0,1fr); gap: 7px; }
  .line { display: flex; min-inline-size: 0; align-items: baseline; gap: 8px; padding: 9px 10px; border: 1px solid #d3d9d0; background: #fffefb; border-radius: 7px; font-size: 13px; text-align: left; }
  .line .c { flex: none; inline-size: 9px; block-size: 9px; border-radius: 50%; box-shadow: 0 0 0 1px #192b2940; }
  .line .s { flex: none; min-inline-size: 42px; font-weight: 650; }
  .line .t { color: #192b29; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .line .t .m { margin-inline-end: 5px; }
  .line .t .pc { font-size: 17px; line-height: 1; vertical-align: -1px; margin-inline-end: 1px; color: #192b29; }
  .line .n { flex: none; color: #556460; margin-inline-start: auto; }
  .panel-settings { margin-block-start: 16px; border-block-start: 1px solid #d3d9d0; }
  .panel-settings summary { display: flex; align-items: center; min-block-size: 48px; gap: 8px; cursor: pointer; color: #192b29; font-size: 16px; font-weight: 650; list-style: none; }
  .panel-settings summary::-webkit-details-marker { display: none; }
  .panel-settings summary::before { content: "+"; display: inline-block; min-inline-size: 16px; color: #17534a; font-size: 20px; }
  .panel-settings details[open] > summary::before, .panel-settings[open] > summary::before { content: "\u2212"; }
  .panel-settings .sec { border-block-start: 1px solid #d3d9d0; padding-block-end: 10px; }
  .panel-settings .sec > summary { color: #556460; font-size: 14px; }
  .panel-settings .opts { display: grid; gap: 14px; }
  .panel-settings .field { display: grid; gap: 5px; min-inline-size: 0; }
  .panel-settings .field > label, .panel-settings .colors-label { font-size: 13px; font-weight: 650; }
  .panel-settings select { inline-size: 100%; min-inline-size: 0; min-block-size: 48px; padding: 9px 10px; font: 16px "Segoe UI",Tahoma,Arial,sans-serif; color: #192b29; background: #fffefb; border: 1px solid #788781; border-radius: 7px; }
  .panel-settings label { cursor: pointer; }
  .panel-settings .check-setting { display: flex; align-items: center; gap: 10px; min-block-size: 48px; font-size: 14px; }
  .panel-settings input[type=checkbox] { flex: none; inline-size: 18px; block-size: 18px; margin: 0; accent-color: #17534a; }
  .panel-settings .opacity { display: flex; align-items: center; gap: 10px; }
  .panel-settings .opacity input { flex: 1; inline-size: 100%; min-inline-size: 0; min-block-size: 48px; margin: 0; accent-color: #17534a; }
  .panel-settings .opacity .pct { min-inline-size: 40px; text-align: end; color: #556460; }
  .panel-header .info-btn { font: italic 700 19px/1 Georgia,"Times New Roman",serif; }
  .panel-header .info-btn.on { background: #17534a; border-color: #17534a; color: #fffefb; }
  .info-box { display: grid; gap: 11px; margin-block-end: 16px; padding: 14px; background: #fffefb; border: 1px solid #b6c6b4; border-radius: 8px; font-size: 13px; line-height: 1.5; }
  .info-box h4 { margin: 0 0 3px; font-size: 16px; font-weight: 650; color: #17534a; }
  .info-box .pr { display: grid; grid-template-columns: 24px minmax(0,1fr); gap: 8px; }
  .info-box .pc { font-size: 24px; line-height: 1.2; color: #192b29; text-align: center; }
  .info-box span.tx { color: #556460; }
  .info-box b { color: #192b29; }
  .acc { margin-block-start: 12px; display: grid; grid-template-columns: minmax(0,1fr) repeat(3,minmax(40px,auto)); gap: 5px 8px; font-size: 12px; align-items: baseline; }
  .acc .h { color: #556460; font-size: 11px; text-align: end; }
  .acc .h:first-child { text-align: start; font-weight: 650; }
  .acc .who { text-transform: capitalize; }
  .acc .who .pc { font-size: 17px; margin-inline-end: 4px; vertical-align: -1px; }
  .acc .v { text-align: end; color: #556460; }
  .acc .latest { font-weight: 700; }
  .acc .n { color: #192b29; }
  .acc .g { color: #17534a; } .acc .y { color: #765000; } .acc .r { color: #9b392d; }
  .panel-settings .swatches { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin-block-start: 5px; }
  .panel-settings .swatches input[type=color] { inline-size: 48px; block-size: 48px; padding: 4px; border: 1px solid #788781; border-radius: 7px; background: #fffefb; cursor: pointer; }
  .panel-settings .reset-btn { display: block; inline-size: 100%; margin-block-start: 12px; }
  .panel-settings .reset-btn.confirm { color: #822b20; border-color: #9b392d; background: #fff1e9; }
  .panel-settings .arrow-note { margin: 0; color: #556460; font-size: 12px; }
  .hint-btn { display: block; inline-size: 100%; margin-block-start: 10px; font-weight: 650; color: #fffefb; background: #17534a; border-color: #17534a; }
  .hint-btn:hover { background: #103f37; }
  .box .training { margin-block-start: 16px; padding: 16px; border: 1px solid #d3d9d0; border-radius: 10px; }
  .box .training h3 { font-size: 19px; }
  .box [hidden] { display: none; }
  @container chess-panel (inline-size < 350px) {
    .panel-header { padding-inline: 10px; gap: 4px; }
    .panel-header .brand-icon { display: none; }
    .box > .body { padding: 12px; }
    .box .training { padding: 14px; }
    .box .training .actions { display: grid; grid-template-columns: minmax(0,1fr); }
  }
</style>
<div class="box">
  <header class="panel-header">
    <span class="title"><span class="brand-icon" aria-hidden="true">\u265E</span><span data-i18n="title"></span></span>
    <button type="button" class="info-btn" data-i18n-title="info.title" aria-expanded="false" aria-controls="piece-help">i</button>
    <button type="button" class="power" data-i18n-title="power.title"></button>
    <button type="button" class="fold" aria-controls="panel-body">\u2212</button>
  </header>
  <div class="panel-intro"><p class="panel-subtitle" data-i18n="panel.subtitle"></p><button type="button" class="settings-jump" data-i18n="panel.settings" aria-controls="panel-settings"></button></div>
  <div class="fair"><span data-i18n="fairplay"></span><button type="button" class="fair-ok" data-i18n="fairplay.ok"></button></div>
  <div class="live" hidden data-i18n="live.warn"></div>
  <div class="body" id="panel-body">
    <div class="info-box" id="piece-help" hidden></div>
    <div class="status" role="status"></div>
    <button type="button" class="hint-btn" data-i18n="hint" hidden></button>
    <div class="best"><span class="san">\u2014</span><span class="score"></span><span class="depth"></span></div>
    <div class="bar"><div></div></div>
    <p class="score-note" data-i18n="score.note"></p>
    <div class="lines"></div>
    <div class="acc" hidden></div>
    <details class="main panel-settings" id="panel-settings" data-sec="settings">
      <summary data-i18n="settings"></summary>
      <details class="sec" data-sec="general">
        <summary data-i18n="group.general"></summary>
        <div class="opts">
        <div class="field"><label for="panel-opacity" data-i18n="opacity"></label><div class="opacity"><input id="panel-opacity" name="opacity" type="range" min="40" max="100" step="5" data-k="opacity"><output for="panel-opacity" class="pct"></output></div></div>
        <div class="field"><label for="panel-language" data-i18n="language"></label><select id="panel-language" name="language" data-k="lang">${Object.entries(LANGS).map(([c, n]) => `<option value="${c}">${n}</option>`).join("")}</select></div>
        </div>
      </details>
      <details class="sec" data-sec="analysis">
        <summary data-i18n="group.analysis"></summary>
        <div class="opts">
        <div class="field"><label for="panel-lines" data-i18n="lines"></label><select id="panel-lines" name="multipv" data-k="multipv"><option>1</option><option>2</option><option>3</option></select></div>
        <div class="field"><label for="panel-depth" data-i18n="depth"></label><select id="panel-depth" name="depth" data-k="depth"><option>10</option><option>12</option><option>14</option><option>16</option><option>18</option><option>20</option><option>22</option></select></div>
        <div class="field"><label for="panel-turn" data-i18n="turn"></label><select id="panel-turn" name="turn" data-k="turn"><option value="auto" data-i18n="turn.auto"></option><option value="w" data-i18n="side.w"></option><option value="b" data-i18n="side.b"></option></select></div>
        <label class="check-setting" for="bottom"><input id="bottom" name="onlyBottom" type="checkbox" data-k="onlyBottom"><span data-i18n="onlyBottom"></span></label>
        <label class="check-setting" for="acc"><input id="acc" name="showAccuracy" type="checkbox" data-k="showAccuracy"><span data-i18n="showAccuracy"></span></label>
        </div>
      </details>
      <details class="sec" data-sec="arrows">
        <summary data-i18n="group.arrows"></summary>
        <div class="opts">
        <label class="check-setting" for="arrows"><input id="arrows" name="arrows" type="checkbox" data-k="arrows"><span data-i18n="arrows"></span></label>
        <p class="arrow-note" data-i18n="arrow.note"></p>
        <label class="check-setting" for="order"><input id="order" name="showOrder" type="checkbox" data-k="showOrder"><span data-i18n="showOrder"></span></label>
        <div><span class="colors-label" data-i18n="colors"></span><div class="swatches">${DEFAULT_COLORS.map((_, i) => `<input type="color" name="color-${i + 1}" data-c="${i}">`).join("")}<button type="button" class="reset-colors" data-i18n-title="colors.reset">\u21BA</button></div></div>
        </div>
      </details>
      <button type="button" class="reset-btn" data-i18n="reset"></button>
    </details>
  </div>
  <div class="foot" data-i18n="engineNote"></div>
</div>`;
  var today = () => {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  var Panel = class {
    constructor(settings2, onChange, onHint2, onReset2) {
      this.onReset = onReset2;
      this.settings = settings2;
      this.onChange = onChange;
      this.onHint = onHint2;
      this.host = document.createElement("div");
      this.root = this.host.attachShadow({ mode: "open" });
      this.root.innerHTML = TEMPLATE;
      document.documentElement.appendChild(this.host);
      const $ = (s) => this.root.querySelector(s);
      this.box = $(".box");
      this.infoEl = $(".info-box");
      this.infoBtn = $(".info-btn");
      this.statusEl = $(".status");
      this.sanEl = $(".best .san");
      this.scoreEl = $(".best .score");
      this.depthEl = $(".best .depth");
      this.barEl = $(".bar > div");
      this.linesEl = $(".lines");
      this.accEl = $(".acc");
      this.powerBtn = $(".power");
      this.foldBtn = $(".fold");
      this.hintBtn = $(".hint-btn");
      this.lastStatus = { key: "status.searching", params: null, err: false };
      this.lastLines = [];
      this.lastAcc = null;
      this.applyPosition();
      this.applyLang();
      this.bind();
    }
    bind() {
      const $ = (s) => this.root.querySelector(s);
      for (const d of this.root.querySelectorAll("details[data-sec]")) {
        d.addEventListener("toggle", () => {
          const id = d.dataset.sec;
          if (this.settings.sections[id] !== d.open) this.set({ sections: { ...this.settings.sections, [id]: d.open } });
        });
      }
      this.foldBtn.addEventListener("click", () => this.set({ collapsed: !this.settings.collapsed }));
      $(".settings-jump").addEventListener("click", () => {
        this.set({ collapsed: false, sections: { ...this.settings.sections, settings: true } });
        const details = $(".panel-settings"), body = $(".body");
        body.scrollTop = details.offsetTop - body.offsetTop;
        details.querySelector("summary").focus({ preventScroll: true });
      });
      this.hintBtn.addEventListener("click", () => this.onHint());
      this.infoBtn.addEventListener("click", () => {
        if (this.settings.collapsed) this.set({ collapsed: false });
        this.infoEl.hidden = !this.infoEl.hidden;
        this.infoBtn.classList.toggle("on", !this.infoEl.hidden);
        this.infoBtn.setAttribute("aria-expanded", String(!this.infoEl.hidden));
      });
      this.liveEl = $(".live");
      this.fairEl = $(".fair");
      this.fairEl.hidden = this.settings.fairAck === today();
      $(".fair-ok").addEventListener("click", () => {
        this.fairEl.hidden = true;
        this.set({ fairAck: today() });
      });
      for (const el of this.root.querySelectorAll("input[data-c]")) {
        el.addEventListener("input", () => {
          const colors = normalizeColors(this.settings.colors);
          colors[+el.dataset.c] = el.value;
          this.set({ colors });
        });
      }
      const resetBtn = $(".reset-btn");
      let armed = null;
      const disarm = () => {
        clearTimeout(armed);
        armed = null;
        resetBtn.classList.remove("confirm");
        resetBtn.textContent = t("reset");
      };
      resetBtn.addEventListener("click", () => {
        if (armed) {
          disarm();
          this.onReset();
          return;
        }
        resetBtn.classList.add("confirm");
        resetBtn.textContent = t("reset.confirm");
        armed = setTimeout(disarm, 3e3);
      });
      $(".reset-colors").addEventListener("click", () => this.set({ colors: [...DEFAULT_COLORS] }));
      this.powerBtn.addEventListener("click", () => this.set({ enabled: !this.settings.enabled }));
      for (const el of this.root.querySelectorAll("[data-k]")) {
        el.addEventListener(el.type === "range" ? "input" : "change", () => {
          const k = el.dataset.k;
          const v = el.type === "checkbox" ? el.checked : el.type === "range" || el.tagName === "SELECT" && /^\d+$/.test(el.value) ? +el.value : el.value;
          this.set({ [k]: v });
        });
      }
      const header = $("header");
      header.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || e.target.closest("button")) return;
        const r = this.box.getBoundingClientRect();
        const ox = e.clientX - r.left;
        const oy = e.clientY - r.top;
        header.setPointerCapture(e.pointerId);
        const move2 = (ev) => {
          this.settings.pos = { left: ev.clientX - ox, top: ev.clientY - oy };
          this.applyPosition();
        };
        const up = () => {
          header.removeEventListener("pointermove", move2);
          header.removeEventListener("pointerup", up);
          header.removeEventListener("pointercancel", up);
          if (header.hasPointerCapture(e.pointerId)) header.releasePointerCapture(e.pointerId);
          this.onChange({ pos: this.settings.pos });
        };
        header.addEventListener("pointermove", move2);
        header.addEventListener("pointerup", up);
        header.addEventListener("pointercancel", up);
      });
      this.onResize = () => this.applyPosition();
      window.addEventListener("resize", this.onResize);
    }
    set(patch) {
      Object.assign(this.settings, patch);
      if ("lang" in patch) setLang(patch.lang);
      this.applyLang();
      this.onChange(patch);
    }
    syncControls() {
      const s = this.settings;
      this.box.classList.toggle("collapsed", !!s.collapsed);
      this.powerBtn.classList.toggle("off", !s.enabled);
      this.powerBtn.textContent = s.enabled ? t("on") : t("off");
      this.powerBtn.setAttribute("aria-pressed", String(!!s.enabled));
      this.foldBtn.setAttribute("aria-expanded", String(!s.collapsed));
      this.foldBtn.textContent = s.collapsed ? "+" : "\u2212";
      this.foldBtn.title = t(s.collapsed ? "fold.expand" : "fold.collapse");
      this.foldBtn.setAttribute("aria-label", this.foldBtn.title);
      this.root.querySelector(".settings-jump").setAttribute("aria-expanded", String(!!s.sections.settings && !s.collapsed));
      this.hintBtn.hidden = !(s.enabled && !s.arrows);
      for (const d of this.root.querySelectorAll("details[data-sec]")) d.open = !!s.sections[d.dataset.sec];
      const opacity = Math.min(100, Math.max(40, +s.opacity || 100));
      this.box.style.opacity = opacity / 100;
      this.root.querySelector(".pct").textContent = opacity + "%";
      const colors = normalizeColors(s.colors);
      this.root.querySelectorAll("input[data-c]").forEach((el) => {
        el.value = colors[+el.dataset.c];
        el.setAttribute("aria-label", t("color.label", { n: +el.dataset.c + 1 }));
      });
      for (const el of this.root.querySelectorAll("[data-k]")) {
        const v = s[el.dataset.k];
        if (el.type === "checkbox") el.checked = !!v;
        else el.value = String(v);
      }
    }
    // Objaśnienie ruchów figur (teksty zależą od języka, więc budujemy je przy każdej zmianie języka).
    renderInfo() {
      const GLYPH = { k: "\u2654", q: "\u2655", r: "\u2656", b: "\u2657", n: "\u2658", p: "\u2659" };
      const head = document.createElement("h4");
      head.textContent = t("info.title");
      const rows = Object.keys(GLYPH).map((k) => {
        const row = document.createElement("div");
        row.className = "pr";
        const pc = document.createElement("span");
        pc.className = "pc";
        pc.textContent = GLYPH[k] + "\uFE0E";
        const name = document.createElement("b");
        name.textContent = t(`piece.${k}`);
        const tx = document.createElement("span");
        tx.className = "tx";
        tx.append(name, " \u2013 " + t(`info.${k}`));
        row.append(pc, tx);
        return row;
      });
      this.infoEl.replaceChildren(head, ...rows);
    }
    applyLang() {
      const lang2 = getLang(), direction = lang2 === "ar" ? "rtl" : "ltr";
      this.host.lang = this.box.lang = lang2;
      this.host.dir = this.box.dir = direction;
      for (const el of this.root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
      for (const el of this.root.querySelectorAll("[data-i18n-title]")) {
        el.title = t(el.dataset.i18nTitle);
        el.setAttribute("aria-label", el.title);
      }
      this.renderInfo();
      this.syncControls();
      this.status(this.lastStatus.key, this.lastStatus.params, this.lastStatus.err);
      this.results(this.lastLines);
      this.accuracy(this.lastAcc);
    }
    applyPosition() {
      const w = this.box.offsetWidth || 380;
      const p = this.settings.pos || { left: window.innerWidth - w - 16, top: 80 };
      this.box.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, p.left)) + "px";
      const top = Math.max(8, Math.min(Math.max(8, window.innerHeight - 240), p.top));
      this.box.style.top = top + "px";
      this.box.style.maxHeight = Math.max(0, window.innerHeight - top - 8) + "px";
    }
    live(show) {
      this.liveEl.hidden = !show;
    }
    // summary: { w: { last, avg, count }, b: {...}, lastSide } z AccuracyTracker.summary() albo null (ukryj).
    accuracy(summary) {
      this.lastAcc = summary;
      this.accEl.hidden = !summary;
      if (!summary) return;
      const cell = (v, extra = "", title = "") => {
        const el = document.createElement("span");
        el.className = `v ${v === null ? "" : v >= 90 ? "g" : v >= 70 ? "y" : "r"} ${extra}`.trim();
        el.textContent = v === null ? "\u2013" : Math.round(v) + "%";
        if (title) el.title = title;
        return el;
      };
      const head = (text) => {
        const el = document.createElement("span");
        el.className = "h";
        el.textContent = text;
        return el;
      };
      const winHead = head(t("acc.win"));
      winHead.title = t("acc.win.title");
      const rows = [head(t("acc.title")), head(t("acc.last")), head(t("acc.avg")), winHead];
      const winCell = (pct) => {
        const el = document.createElement("span");
        el.className = `v ${pct === null ? "" : pct >= 60 ? "g" : pct <= 40 ? "r" : "n"}`.trim();
        el.textContent = pct === null ? "\u2013" : Math.round(pct) + "%";
        return el;
      };
      for (const side2 of ["w", "b"]) {
        const s = summary[side2];
        const who = document.createElement("span");
        who.className = "who";
        const pc = document.createElement("span");
        pc.className = "pc";
        pc.textContent = side2 === "w" ? "\u2654\uFE0E" : "\u265A\uFE0E";
        who.append(pc, t(`side.${side2}`));
        const latest = summary.lastSide === side2 ? "latest" : "";
        const win = summary.win === null ? null : side2 === "w" ? summary.win : 100 - summary.win;
        rows.push(who, cell(s.last, latest), cell(s.avg, "", t("acc.moves", { n: s.count })), winCell(win));
      }
      this.accEl.replaceChildren(...rows);
    }
    toggleVisible() {
      this.host.style.display = this.host.style.display === "none" ? "" : "none";
    }
    status(key, params = null, isError = false) {
      this.lastStatus = { key, params, err: isError };
      this.statusEl.textContent = t(key, params);
      this.statusEl.classList.toggle("err", isError);
    }
    // lines: [{ san, scoreText, items: [{ san, white }], fullText, count, depth, percent }] posortowane wg multipv
    results(lines2) {
      const signature = JSON.stringify([lines2, this.settings.colors, getLang()]);
      if (this.resultsSignature === signature) return;
      this.resultsSignature = signature;
      this.lastLines = lines2;
      if (!lines2.length) {
        this.sanEl.textContent = "\u2014";
        this.scoreEl.textContent = "";
        this.depthEl.textContent = "";
        this.barEl.style.width = "50%";
        this.linesEl.replaceChildren();
        return;
      }
      const top = lines2[0];
      this.sanEl.textContent = top.san || "\u2014";
      this.scoreEl.textContent = top.scoreText;
      this.depthEl.textContent = t("depthLabel", { n: top.depth });
      this.barEl.style.width = top.percent.toFixed(1) + "%";
      this.linesEl.replaceChildren(
        ...lines2.map((l, i) => {
          const row = document.createElement("div");
          row.className = "line";
          const dot = document.createElement("span");
          dot.className = "c";
          dot.style.background = normalizeColors(this.settings.colors)[i % DEFAULT_COLORS.length];
          const s = document.createElement("span");
          s.className = "s";
          s.textContent = l.scoreText;
          const t2 = document.createElement("span");
          t2.className = "t";
          for (const it of l.items) {
            const { icon, rest } = figurine(it.san, it.white);
            const m = document.createElement("span");
            m.className = "m";
            if (icon) {
              const pc = document.createElement("span");
              pc.className = "pc";
              pc.textContent = icon;
              m.append(pc);
            }
            m.append(rest);
            t2.append(m);
          }
          t2.title = l.fullText;
          const n = document.createElement("span");
          n.className = "n";
          n.textContent = `(${l.count})`;
          row.append(dot, s, t2, n);
          return row;
        })
      );
    }
    destroy() {
      window.removeEventListener("resize", this.onResize);
      this.host.remove();
    }
  };

  // src/content/livegame.js
  var LICHESS_SAFE = /^\/(analysis|study|training|practice|editor|learn|opening|tablebase|coordinate|storm|racer|streak|tv|broadcast|@|video|team|insights)(\/|$)/;
  var LICHESS_GAME = /^\/([A-Za-z0-9]{8})([A-Za-z0-9]{4})?(\/(white|black))?\/?$/;
  var CHESSCOM_SAFE = /^\/(play\/computer|analysis|puzzles|explorer|lessons|practice|drills|learn|openings|library|events|article|news|members|club|forum|games\/archive|insights)(\/|$)/;
  var CHESSCOM_LIVE = /^\/(play\/online|game\/live|game\/daily|game\/\d+|live|daily|play\/vs-friend|play\/friend)(\/|#|$)/;
  function classifyUrl(host, path) {
    if (host.endsWith("lichess.org")) {
      if (LICHESS_SAFE.test(path)) return "safe";
      const m = LICHESS_GAME.exec(path);
      if (!m) return "unknown";
      return m[2] ? "check" : "safe";
    }
    if (host.endsWith("chess.com")) {
      if (CHESSCOM_SAFE.test(path)) return "safe";
      if (CHESSCOM_LIVE.test(path)) return "check";
      return "unknown";
    }
    return "unknown";
  }
  var BOT_NAME = /stockfish|\blevel\s*\d|computer|\bbot\b|\bAI\b/i;
  var LICHESS_USERS = ".ruser-top, .ruser-bottom";
  var LICHESS_FINISHED = ".rcontrols .follow-up, .rcontrols .rematch, .result-wrap";
  var CHESSCOM_FINISHED = '.game-over-modal-container, .game-over-modal-component, .game-over-header-component, [data-cy="game-over-modal"]';
  var CHESSCOM_BOT = '.bot-selection-component, .bot-game, [class*="bot-"][class*="player"]';
  function textOf(doc, selector) {
    return [...doc.querySelectorAll(selector)].map((e) => e.textContent || "").join(" ");
  }
  function detectLive(loc, doc) {
    const kind = classifyUrl(loc.hostname, loc.pathname);
    if (kind === "safe" || kind === "unknown") return { live: false, reason: kind };
    if (loc.hostname.endsWith("lichess.org")) {
      if (doc.querySelector(LICHESS_FINISHED)) return { live: false, reason: "finished" };
      if (BOT_NAME.test(textOf(doc, LICHESS_USERS))) return { live: false, reason: "bot" };
      return { live: true, reason: "lichess-game" };
    }
    if (doc.querySelector(CHESSCOM_FINISHED)) return { live: false, reason: "finished" };
    if (doc.querySelector(CHESSCOM_BOT)) return { live: false, reason: "bot" };
    return { live: true, reason: "chesscom-game" };
  }

  // src/content/accuracy.js
  var MIN_DEPTH = 8;
  var posKey = (fen) => fen.split(" ").slice(0, 2).join(" ");
  function isLegalTransition(fromFen, toFen) {
    try {
      const target = posKey(toFen);
      return new Chess(fromFen).moves({ verbose: true }).some((m) => posKey(m.after) === target);
    } catch (_) {
      return false;
    }
  }
  function accuracyFromLoss(loss) {
    const a = 103.1668100711649 * Math.exp(-0.04354415386753951 * loss) - 3.166924740191411 + 1;
    return Math.max(0, Math.min(100, a));
  }
  var AccuracyTracker = class {
    constructor() {
      this.reset();
    }
    reset() {
      this.evals = /* @__PURE__ */ new Map();
      this.moves = [];
      this.prev = null;
    }
    // Nowa pozycja na planszy. Jeśli nie wynika z legalnego ruchu poprzedniej (skok, nowa partia), zaczynamy od zera.
    onPosition(fen) {
      const key = posKey(fen);
      if (this.prev && this.prev.key !== key) {
        if (isLegalTransition(this.prev.fen, fen)) {
          this.moves.push({ side: this.prev.fen.split(" ")[1], from: this.prev.key, to: key });
        } else {
          this.evals.clear();
          this.moves = [];
        }
      }
      this.prev = { fen, key };
    }
    onEval(fen, info) {
      const key = posKey(fen);
      const cur = this.evals.get(key);
      if (!cur || info.depth >= cur.depth) this.evals.set(key, { score: whitePercent(info), depth: info.depth });
    }
    moveAccuracy(m) {
      const a = this.evals.get(m.from);
      const b = this.evals.get(m.to);
      if (!a || !b || a.depth < MIN_DEPTH || b.depth < MIN_DEPTH) return null;
      const mine = (s) => m.side === "w" ? s : 100 - s;
      return accuracyFromLoss(Math.max(0, mine(a.score) - mine(b.score)));
    }
    winChance() {
      const cur = this.prev && this.evals.get(this.prev.key);
      return cur && cur.depth >= MIN_DEPTH ? cur.score : null;
    }
    // { w: { last, avg, count }, b: {...}, lastSide, win } albo null; win = szanse białych (czarnych: 100 − win).
    summary() {
      const win = this.winChance();
      if (!this.moves.length && win === null) return null;
      const out = { lastSide: this.moves.length ? this.moves[this.moves.length - 1].side : null, win };
      for (const side2 of ["w", "b"]) {
        const own = this.moves.filter((m) => m.side === side2);
        const vals = own.map((m) => this.moveAccuracy(m));
        const known = vals.filter((v) => v !== null);
        out[side2] = {
          last: own.length ? vals[vals.length - 1] : null,
          avg: known.length ? known.reduce((x, y) => x + y, 0) / known.length : null,
          count: own.length
        };
      }
      return out;
    }
  };

  // src/shared/training.js
  var EXPLANATION_LANGUAGES = Object.freeze(["en", "ar"]);
  var REASONING_EFFORTS = Object.freeze(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
  function exact(value, keys) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) throw new Error("Invalid fields");
  }
  function integer(n, min, max) {
    if (!Number.isInteger(n) || n < min || n > max) throw new Error("Invalid number");
    return n;
  }
  function move(chess, uci) {
    if (typeof uci !== "string" || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error("Invalid move");
    const result = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    if (!result) throw new Error("Illegal move");
    return result;
  }
  function validateFen2(fen) {
    if (typeof fen !== "string" || fen.length > 100 || !/^[prnbqkPRNBQK1-8/]+ [wb] (?:-|K?Q?k?q?) (?:-|[a-h][36]) \d{1,5} [1-9]\d{0,4}$/.test(fen)) throw new Error("Invalid FEN");
    const chess = new Chess(fen);
    const turn = chess.turn();
    const opponent = turn === "w" ? "b" : "w";
    const king = chess.board().flat().find((p) => p?.type === "k" && p.color === opponent);
    if (!king || chess.isAttacked(king.square, turn)) throw new Error("Impossible position");
    const rights = fen.split(" ")[2];
    for (const [right, k, r, color] of [["K", "e1", "h1", "w"], ["Q", "e1", "a1", "w"], ["k", "e8", "h8", "b"], ["q", "e8", "a8", "b"]]) {
      if (rights.includes(right) && (chess.get(k)?.type !== "k" || chess.get(k)?.color !== color || chess.get(r)?.type !== "r" || chess.get(r)?.color !== color)) throw new Error("Invalid castling rights");
    }
    const ep = fen.split(" ")[3];
    if (ep !== "-") {
      const pawnSquare = ep[0] + (turn === "w" ? "5" : "4");
      const originSquare = ep[0] + (turn === "w" ? "7" : "2");
      if (chess.get(ep) || chess.get(originSquare) || chess.get(pawnSquare)?.type !== "p" || chess.get(pawnSquare)?.color !== opponent) throw new Error("Invalid en passant target");
    }
    return chess;
  }
  function validateSettings(s) {
    exact(s, ["rating", "timeBudgetSeconds", "simulateWeights", ...["language", "reasoningEffort"].filter((key) => Object.hasOwn(s ?? {}, key))]);
    integer(s.rating, 400, 2800);
    integer(s.timeBudgetSeconds, 5, 600);
    if (typeof s.simulateWeights !== "boolean") throw new Error("Invalid weights setting");
    const language = Object.hasOwn(s, "language") ? s.language : "en";
    const reasoningEffort = Object.hasOwn(s, "reasoningEffort") ? s.reasoningEffort : "default";
    if (!EXPLANATION_LANGUAGES.includes(language)) throw new Error("Invalid explanation language");
    if (reasoningEffort !== "default" && !REASONING_EFFORTS.includes(reasoningEffort)) throw new Error("Invalid reasoning effort");
    return { rating: s.rating, timeBudgetSeconds: s.timeBudgetSeconds, simulateWeights: s.simulateWeights, language, reasoningEffort };
  }
  function validateTraining(value) {
    exact(value, ["fen", "sideToMove", "candidates", "settings"]);
    const chess = validateFen2(value.fen);
    if (value.sideToMove !== chess.turn()) throw new Error("Side does not match FEN");
    if (!Array.isArray(value.candidates) || value.candidates.length < 1 || value.candidates.length > 3 || chess.isGameOver()) throw new Error("No playable candidates");
    const seen = /* @__PURE__ */ new Set();
    const candidates = value.candidates.map((c) => {
      exact(c, ["move", "score", "depth", "pv"]);
      exact(c.score, ["type", "value", "perspective"]);
      if (!["cp", "mate"].includes(c.score.type) || c.score.perspective !== "white") throw new Error("Invalid score perspective");
      integer(c.score.value, -1e5, 1e5);
      if (c.score.type === "mate" && (c.score.value === 0 || Math.abs(c.score.value) > 1e3)) throw new Error("Invalid mate score");
      integer(c.depth, 1, 30);
      if (!Array.isArray(c.pv) || c.pv.length < 1 || c.pv.length > 6 || c.pv[0] !== c.move || seen.has(c.move)) throw new Error("Invalid variation");
      seen.add(c.move);
      const replay = new Chess(value.fen);
      c.pv.forEach((uci) => move(replay, uci));
      return { move: c.move, score: { ...c.score }, depth: c.depth, pv: [...c.pv] };
    });
    return { fen: value.fen, sideToMove: value.sideToMove, candidates, settings: validateSettings(value.settings) };
  }
  function utility(score, turn) {
    const v = score.value * (turn === "b" ? -1 : 1);
    return score.type === "mate" ? Math.sign(v) * (1e6 - Math.abs(v)) : Math.max(-1e5, Math.min(1e5, v));
  }
  function estimateTraining(input) {
    const data = validateTraining(input);
    const values = data.candidates.map((c) => utility(c.score, data.sideToMove));
    const best = Math.max(...values);
    const ordered = [...values].sort((a, b) => b - a);
    const gap = ordered.length > 1 ? Math.min(400, ordered[0] - ordered[1]) : 0;
    let tactical = 0;
    for (const c of data.candidates) {
      const board = new Chess(data.fen);
      for (const uci of c.pv) if (/[x+#]/.test(move(board, uci).san)) tactical++;
    }
    const level = tactical >= 5 || gap >= 150 ? "high" : tactical >= 2 || gap >= 50 ? "medium" : "low";
    const ratingFactor = 1.4 - (data.settings.rating - 400) / 4e3;
    const seconds = (level === "high" ? 38 : level === "medium" ? 22 : 12) * ratingFactor;
    const maxSeconds = Math.min(data.settings.timeBudgetSeconds, Math.max(2, Math.round(seconds * 1.5)));
    const minSeconds = Math.min(maxSeconds, Math.max(1, Math.round(seconds * 0.6)));
    const temperature = Math.max(25, 220 - (data.settings.rating - 400) * 0.075);
    const weights = values.map((v) => Math.exp(Math.max(-700, (v - best) / temperature)));
    const total = weights.reduce((a, b) => a + b, 0);
    const precise = weights.map((w) => w / total * 100);
    const percentages = precise.map(Math.floor);
    const remainder = 100 - percentages.reduce((a, b) => a + b, 0);
    [...precise.keys()].sort((a, b) => precise[b] - percentages[b] - (precise[a] - percentages[a])).slice(0, remainder).forEach((i) => percentages[i]++);
    return { level, minSeconds, maxSeconds, weights: data.settings.simulateWeights ? data.candidates.map((c, i) => ({ move: c.move, percent: percentages[i] })) : null };
  }
  function prose(s, max = 240) {
    if (typeof s !== "string" || !s.trim() || s.length > max || /[<>&\u0000-\u001f\u202a-\u202e\u2066-\u2069]/.test(s)) throw new Error("Unsafe or ungrounded explanation text");
    const notation = s.normalize("NFKC").replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) & 15));
    if (/https?:|\b[a-h][1-9]\b|\b[a-h][1-9][a-h][1-9]|\b(?:[KQRBN][a-h]?[1-8]?x?[a-h][1-9]|O-O(?:-O)?)\b/i.test(notation)) throw new Error("Unsafe or ungrounded explanation text");
    return s;
  }
  function validateExplanation(out, input) {
    const data = validateTraining(input);
    exact(out, ["complexity", "threats", "candidates"]);
    exact(out.complexity, ["level", "reason"]);
    if (!["low", "medium", "high"].includes(out.complexity.level)) throw new Error("Invalid complexity");
    prose(out.complexity.reason);
    if (!Array.isArray(out.threats) || out.threats.length > 3 || !Array.isArray(out.candidates) || out.candidates.length !== data.candidates.length) throw new Error("Invalid explanation");
    const seen = /* @__PURE__ */ new Set();
    for (const c of out.candidates) {
      exact(c, ["move", "idea", "tradeoff"]);
      if (!data.candidates.some((x) => x.move === c.move) || seen.has(c.move)) throw new Error("Invented or repeated candidate");
      seen.add(c.move);
      prose(c.idea);
      prose(c.tradeoff);
    }
    for (const t2 of out.threats) {
      exact(t2, ["candidateMove", "replyMove", "description"]);
      const c = data.candidates.find((x) => x.move === t2.candidateMove);
      if (!c || c.pv[1] !== t2.replyMove) throw new Error("Invented reply");
      prose(t2.description);
    }
    return out;
  }
  var Generation = class {
    id = 0;
    key = "";
    update(key) {
      if (key !== this.key) {
        this.key = key;
        this.id++;
      }
      return this.id;
    }
    invalidate() {
      this.id++;
    }
    current(id) {
      return this.id === id;
    }
  };
  function trainingContext(url) {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && ["chess.com", "www.chess.com"].includes(u.hostname) && /^\/(?:play\/computer|analysis)(?:\/|$)/.test(u.pathname);
    } catch {
      return false;
    }
  }

  // src/ui/preferences.js
  var efforts = ["default", "none", "minimal", "low", "medium", "high", "xhigh", "max"];
  function normalizePreferences(value = {}) {
    const data = value && typeof value === "object" ? value : {};
    return {
      uiLanguage: data.uiLanguage === "ar" ? "ar" : "en",
      explanationLanguage: data.explanationLanguage === "ar" ? "ar" : "en",
      reasoningEffort: efforts.includes(data.reasoningEffort) ? data.reasoningEffort : "default",
      reasoningModel: typeof data.reasoningModel === "string" && /^[A-Za-z0-9_.:-]{1,100}$/.test(data.reasoningModel) ? data.reasoningModel : null
    };
  }
  async function readPreferences() {
    const { trainingPreferences } = await chrome.storage.local.get("trainingPreferences");
    return normalizePreferences(trainingPreferences);
  }
  var pending = Promise.resolve();
  function savePreferences(patch) {
    const task = pending.then(async () => {
      const next = normalizePreferences({ ...await readPreferences(), ...patch });
      await chrome.storage.local.set({ trainingPreferences: next });
      return next;
    });
    pending = task.catch(() => {
    });
    return task;
  }
  function watchPreferences(callback) {
    const listener = (changes, area) => {
      if (area === "local" && changes.trainingPreferences) callback(normalizePreferences(changes.trainingPreferences.newValue));
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }

  // src/shared/explanation-errors.js
  var GROUPS = [
    {
      codes: ["extension_reloaded"],
      en: "The extension was reloaded or updated. Refresh this chess tab, then request the explanation again.",
      ar: "\u0623\u064F\u0639\u064A\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0625\u0636\u0627\u0641\u0629 \u0623\u0648 \u062A\u062D\u062F\u064A\u062B\u0647\u0627. \u062D\u062F\u0651\u062B \u0639\u0644\u0627\u0645\u0629 \u062A\u0628\u0648\u064A\u0628 \u0627\u0644\u0634\u0637\u0631\u0646\u062C \u0647\u0630\u0647\u060C \u062B\u0645 \u0627\u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u062D \u0645\u062C\u062F\u062F\u064B\u0627."
    },
    {
      codes: ["invalid_request", "openai_http_400", "openai_http_422"],
      en: "The explanation request was rejected. Refresh this chess tab; if it repeats, report the code below so the app\u2019s request can be checked.",
      ar: "\u0631\u064F\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u062D. \u062D\u062F\u0651\u062B \u0639\u0644\u0627\u0645\u0629 \u062A\u0628\u0648\u064A\u0628 \u0627\u0644\u0634\u0637\u0631\u0646\u062C \u0647\u0630\u0647\u061B \u0648\u0625\u0630\u0627 \u062A\u0643\u0631\u0631 \u0627\u0644\u062E\u0637\u0623\u060C \u0641\u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647 \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0630\u064A \u064A\u0631\u0633\u0644\u0647 \u0627\u0644\u062A\u0637\u0628\u064A\u0642."
    },
    {
      codes: ["openai_http_401"],
      en: "The AI service did not accept the request\u2019s authorization. Check the account status in AI settings; if it repeats, report the code below.",
      ar: "\u0644\u0645 \u062A\u0642\u0628\u0644 \u062E\u062F\u0645\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u062A\u0641\u0648\u064A\u0636 \u0627\u0644\u0637\u0644\u0628. \u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A\u061B \u0648\u0625\u0630\u0627 \u062A\u0643\u0631\u0631 \u0627\u0644\u062E\u0637\u0623\u060C \u0641\u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647."
    },
    {
      codes: ["openai_http_403"],
      en: "The AI service denied this request because of permission or policy. Review the selected account and available model in AI settings, and report the code if it persists.",
      ar: "\u0631\u0641\u0636\u062A \u062E\u062F\u0645\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628 \u0628\u0633\u0628\u0628 \u0625\u0630\u0646 \u0623\u0648 \u0633\u064A\u0627\u0633\u0629. \u0631\u0627\u062C\u0639 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062D\u062F\u062F \u0648\u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u062A\u0627\u062D \u0641\u064A \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A\u060C \u0648\u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0625\u0630\u0627 \u0627\u0633\u062A\u0645\u0631 \u0627\u0644\u062E\u0637\u0623."
    },
    {
      codes: ["openai_http_404"],
      en: "The AI service could not find the requested resource. Refresh the available models in AI settings; if it repeats, report the code below.",
      ar: "\u0644\u0645 \u062A\u0639\u062B\u0631 \u062E\u062F\u0645\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0639\u0644\u0649 \u0627\u0644\u0645\u0648\u0631\u062F \u0627\u0644\u0645\u0637\u0644\u0648\u0628. \u062D\u062F\u0651\u062B \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0646\u0645\u0627\u0630\u062C \u0627\u0644\u0645\u062A\u0627\u062D\u0629 \u0641\u064A \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A\u061B \u0648\u0625\u0630\u0627 \u062A\u0643\u0631\u0631 \u0627\u0644\u062E\u0637\u0623\u060C \u0641\u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647."
    },
    {
      codes: ["openai_http_409"],
      en: "The request conflicted with the AI service\u2019s current state. Wait before requesting another explanation; if it repeats, report the code below.",
      ar: "\u062A\u0639\u0627\u0631\u0636 \u0627\u0644\u0637\u0644\u0628 \u0645\u0639 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A. \u0627\u0646\u062A\u0638\u0631 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0634\u0631\u062D \u0622\u062E\u0631\u061B \u0648\u0625\u0630\u0627 \u062A\u0643\u0631\u0631 \u0627\u0644\u062E\u0637\u0623\u060C \u0641\u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647."
    },
    {
      codes: ["openai_http_413"],
      en: "The AI service rejected the request\u2019s size. Report the code below so the app\u2019s request can be checked.",
      ar: "\u0631\u0641\u0636\u062A \u062E\u062F\u0645\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u062D\u062C\u0645 \u0627\u0644\u0637\u0644\u0628. \u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647 \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0630\u064A \u064A\u0631\u0633\u0644\u0647 \u0627\u0644\u062A\u0637\u0628\u064A\u0642."
    },
    {
      codes: ["openai_http_429"],
      en: "The AI service reported a usage or request-rate limit. Review usage in AI settings and wait before requesting another explanation.",
      ar: "\u0623\u0628\u0644\u063A\u062A \u062E\u062F\u0645\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0639\u0646 \u062D\u062F \u0644\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0623\u0648 \u0645\u0639\u062F\u0644 \u0627\u0644\u0637\u0644\u0628\u0627\u062A. \u0631\u0627\u062C\u0639 \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0641\u064A \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0648\u0627\u0646\u062A\u0638\u0631 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0634\u0631\u062D \u0622\u062E\u0631."
    },
    {
      codes: ["openai_http_500", "openai_http_502", "openai_http_503"],
      en: "The AI service could not complete this request. Keep your current sign-in and try again later.",
      ar: "\u062A\u0639\u0630\u0651\u0631 \u0639\u0644\u0649 \u062E\u062F\u0645\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0625\u0643\u0645\u0627\u0644 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628. \u0627\u062D\u062A\u0641\u0638 \u0628\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u062D\u0627\u0644\u064A \u0648\u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627."
    },
    {
      codes: ["request_in_progress", "sign_out_in_progress"],
      en: "Another explanation or account action is still running. Wait for it to finish before requesting an explanation.",
      ar: "\u0645\u0627 \u0632\u0627\u0644 \u0637\u0644\u0628 \u0634\u0631\u062D \u0623\u0648 \u0625\u062C\u0631\u0627\u0621 \u0645\u062A\u0639\u0644\u0642 \u0628\u0627\u0644\u062D\u0633\u0627\u0628 \u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630. \u0627\u0646\u062A\u0638\u0631 \u0627\u0646\u062A\u0647\u0627\u0621\u0647 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u062D."
    },
    {
      codes: ["local_rate_limit"],
      en: "The local request limit was reached. Wait before requesting another explanation.",
      ar: "\u0628\u0644\u063A\u062A \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u062D\u0644\u064A \u0644\u0644\u0637\u0644\u0628\u0627\u062A. \u0627\u0646\u062A\u0638\u0631 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0634\u0631\u062D \u0622\u062E\u0631."
    },
    {
      codes: ["sign_in_required"],
      en: "Open AI settings and sign in with ChatGPT before requesting an explanation.",
      ar: "\u0627\u0641\u062A\u062D \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0648\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 ChatGPT \u0642\u0628\u0644 \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u062D."
    },
    {
      codes: ["invalid_grant", "invalid_refresh_token", "token_expired", "refresh_token_expired", "refresh_token_invalidated", "refresh_token_reused"],
      en: "The saved sign-in session is no longer valid. Open AI settings and sign in with ChatGPT again.",
      ar: "\u0644\u0645 \u062A\u0639\u062F \u062C\u0644\u0633\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u062D\u0641\u0648\u0638\u0629 \u0635\u0627\u0644\u062D\u0629. \u0627\u0641\u062A\u062D \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0648\u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 ChatGPT \u0645\u062C\u062F\u062F\u064B\u0627."
    },
    {
      codes: ["plan_permission_required"],
      en: "ChatGPT-plan permission is required. Open AI settings and review the plan permission during sign-in.",
      ar: "\u064A\u0644\u0632\u0645 \u0645\u0646\u062D \u0627\u0644\u0625\u0630\u0646 \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u062E\u0637\u0629 ChatGPT. \u0627\u0641\u062A\u062D \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0648\u0631\u0627\u062C\u0639 \u0625\u0630\u0646 \u0627\u0644\u062E\u0637\u0629 \u0623\u062B\u0646\u0627\u0621 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644."
    },
    {
      codes: ["subscription_sharing_usage_limit_exceeded"],
      en: "A ChatGPT-plan usage limit was reached; it may apply specifically to this app. Review usage in AI settings before requesting another explanation.",
      ar: "\u0628\u0644\u063A\u062A \u0623\u062D\u062F \u062D\u062F\u0648\u062F \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u062E\u0637\u0629 ChatGPT\u061B \u0648\u0642\u062F \u064A\u0643\u0648\u0646 \u062E\u0627\u0635\u064B\u0627 \u0628\u0647\u0630\u0627 \u0627\u0644\u062A\u0637\u0628\u064A\u0642. \u0631\u0627\u062C\u0639 \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0645\u0646 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0642\u0628\u0644 \u0637\u0644\u0628 \u0634\u0631\u062D \u0622\u062E\u0631."
    },
    {
      codes: ["subscription_sharing_usage_unavailable"],
      en: "ChatGPT could not check usage availability. Keep your current sign-in and try again later.",
      ar: "\u062A\u0639\u0630\u0651\u0631 \u0639\u0644\u0649 ChatGPT \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u062A\u0648\u0641\u0631 \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645. \u0627\u062D\u062A\u0641\u0638 \u0628\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u062D\u0627\u0644\u064A \u0648\u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627."
    },
    {
      codes: ["select_model_in_settings", "model_unavailable"],
      en: "Open AI settings, refresh the available models, then choose and save a model offered for your account.",
      ar: "\u0627\u0641\u062A\u062D \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0648\u062D\u062F\u0651\u062B \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0646\u0645\u0627\u0630\u062C\u060C \u062B\u0645 \u0627\u062E\u062A\u0631 \u0646\u0645\u0648\u0630\u062C\u064B\u0627 \u0645\u062A\u0627\u062D\u064B\u0627 \u0644\u062D\u0633\u0627\u0628\u0643 \u0648\u0627\u062D\u0641\u0638\u0647."
    },
    {
      codes: ["reasoning_effort_unavailable"],
      en: "The selected model does not support that thinking mode. Choose Model default in AI settings and save your preferences.",
      ar: "\u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0645\u062D\u062F\u062F \u0644\u0627 \u064A\u062F\u0639\u0645 \u0648\u0636\u0639 \u0627\u0644\u062A\u0641\u0643\u064A\u0631 \u0647\u0630\u0627. \u0627\u062E\u062A\u0631 \u0627\u0641\u062A\u0631\u0627\u0636\u064A \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0648\u0627\u062D\u0641\u0638 \u062A\u0641\u0636\u064A\u0644\u0627\u062A\u0643."
    },
    {
      codes: ["subscription_sharing_unsupported_capability"],
      en: "The request uses a capability that is unsupported through your plan. Report the code below so the app\u2019s request can be checked.",
      ar: "\u064A\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0637\u0644\u0628 \u0645\u064A\u0632\u0629 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629 \u0639\u0628\u0631 \u062E\u0637\u062A\u0643. \u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647 \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0630\u064A \u064A\u0631\u0633\u0644\u0647 \u0627\u0644\u062A\u0637\u0628\u064A\u0642."
    },
    {
      codes: ["subscription_sharing_user_not_eligible"],
      en: "ChatGPT-plan use is unavailable for the selected account, workspace or policy. Review the account restrictions; repeating sign-in will not resolve this error.",
      ar: "\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u062E\u0637\u0629 ChatGPT \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0644\u0644\u062D\u0633\u0627\u0628 \u0623\u0648 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0639\u0645\u0644 \u0623\u0648 \u0627\u0644\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629. \u0631\u0627\u062C\u0639 \u0642\u064A\u0648\u062F \u0627\u0644\u062D\u0633\u0627\u0628\u061B \u062A\u0643\u0631\u0627\u0631 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0627 \u064A\u062D\u0644 \u0647\u0630\u0627 \u0627\u0644\u062E\u0637\u0623."
    },
    {
      codes: ["subscription_sharing_user_unavailable"],
      en: "ChatGPT account or workspace information is temporarily unavailable. Keep your current sign-in and try again later.",
      ar: "\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u062D\u0633\u0627\u0628 ChatGPT \u0623\u0648 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u0639\u0645\u0644 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0645\u0624\u0642\u062A\u064B\u0627. \u0627\u062D\u062A\u0641\u0638 \u0628\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u062D\u0627\u0644\u064A \u0648\u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627."
    },
    {
      codes: ["subscription_sharing_invalid_user", "chatpass_v2_scope_not_authorized", "chatpass_v2_invalid_authorization_context"],
      en: "The account authorization could not be validated for this request. Report the code below so the app\u2019s authorization can be checked.",
      ar: "\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u062A\u0641\u0648\u064A\u0636 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628. \u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647 \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u062A\u0641\u0648\u064A\u0636 \u0627\u0644\u062A\u0637\u0628\u064A\u0642."
    },
    {
      codes: ["subscription_sharing_route_not_supported"],
      en: "The app\u2019s AI request route is unsupported. Update the extension and companion together; if it repeats, report the code below.",
      ar: "\u0645\u0633\u0627\u0631 \u0637\u0644\u0628 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0641\u064A \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645. \u062D\u062F\u0651\u062B \u0627\u0644\u0625\u0636\u0627\u0641\u0629 \u0648\u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0645\u0631\u0627\u0641\u0642 \u0645\u0639\u064B\u0627\u061B \u0648\u0625\u0630\u0627 \u062A\u0643\u0631\u0631 \u0627\u0644\u062E\u0637\u0623\u060C \u0641\u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647."
    },
    {
      codes: ["sharing_required"],
      en: "Enable position sharing in AI settings before requesting an explanation.",
      ar: "\u0641\u0639\u0651\u0644 \u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0648\u0636\u0639\u064A\u0627\u062A \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0642\u0628\u0644 \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u062D."
    },
    {
      codes: ["practice_confirmation_required", "unsupported_context"],
      en: "Use local study or a supported analysis or built-in bot page, and confirm the practice checkbox before requesting an explanation.",
      ar: "\u0627\u0633\u062A\u062E\u062F\u0645 \u0644\u0648\u062D\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u0629 \u0627\u0644\u0645\u062D\u0644\u064A\u0629 \u0623\u0648 \u0635\u0641\u062D\u0629 \u062A\u062D\u0644\u064A\u0644 \u0623\u0648 \u0631\u0648\u0628\u0648\u062A \u0645\u062F\u0645\u062C \u0645\u062F\u0639\u0648\u0645\u0629\u060C \u0648\u0623\u0643\u0651\u062F \u0645\u0631\u0628\u0639 \u0627\u0644\u062A\u062F\u0631\u064A\u0628 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u062D."
    },
    {
      codes: ["companion_unavailable"],
      en: "The local companion could not be reached. Start it with this extension\u2019s ID, then check the connection in AI settings.",
      ar: "\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u0645\u062D\u0644\u064A. \u0634\u063A\u0651\u0644\u0647 \u0628\u0645\u0639\u0631\u0651\u0641 \u0647\u0630\u0647 \u0627\u0644\u0625\u0636\u0627\u0641\u0629\u060C \u062B\u0645 \u0627\u0641\u062D\u0635 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0645\u0646 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A."
    },
    {
      codes: ["companion_timeout"],
      en: "The local companion did not respond in time. Check that it is running, then request the explanation when ready.",
      ar: "\u0644\u0645 \u064A\u0633\u062A\u062C\u0628 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u0645\u062D\u0644\u064A \u0641\u064A \u0627\u0644\u0648\u0642\u062A \u0627\u0644\u0645\u062D\u062F\u062F. \u062A\u0623\u0643\u062F \u0645\u0646 \u062A\u0634\u063A\u064A\u0644\u0647\u060C \u062B\u0645 \u0627\u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u062D \u0639\u0646\u062F\u0645\u0627 \u062A\u0643\u0648\u0646 \u0645\u0633\u062A\u0639\u062F\u064B\u0627."
    },
    {
      codes: ["upstream_timeout", "openai_http_408", "openai_http_504"],
      en: "The AI service did not finish in time. Try again later; you can also choose a lower supported thinking mode in AI settings.",
      ar: "\u0644\u0645 \u062A\u064F\u0643\u0645\u0644 \u062E\u062F\u0645\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0627\u0644\u0637\u0644\u0628 \u0641\u064A \u0627\u0644\u0648\u0642\u062A \u0627\u0644\u0645\u062D\u062F\u062F. \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627\u061B \u0648\u064A\u0645\u0643\u0646\u0643 \u0627\u062E\u062A\u064A\u0627\u0631 \u0648\u0636\u0639 \u062A\u0641\u0643\u064A\u0631 \u0623\u0642\u0644 \u064A\u062F\u0639\u0645\u0647 \u0627\u0644\u0646\u0645\u0648\u0630\u062C \u0645\u0646 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A."
    },
    {
      codes: ["upstream_unavailable", "oauth_unavailable"],
      en: "The companion could not reach the AI service. Check your connection and try again later.",
      ar: "\u062A\u0639\u0630\u0651\u0631 \u0639\u0644\u0649 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0645\u0631\u0627\u0641\u0642 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u062E\u062F\u0645\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A. \u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u0627\u062A\u0635\u0627\u0644\u0643 \u0648\u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627."
    },
    {
      codes: ["invalid_stream_type", "malformed_stream", "interrupted_stream", "inference_incomplete", "inference_failed", "empty_response"],
      en: "The AI service did not return a complete supported response. No explanation was accepted. Try again later; if it repeats, report the code below.",
      ar: "\u0644\u0645 \u062A\u064F\u0639\u062F \u062E\u062F\u0645\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0631\u062F\u064B\u0627 \u0645\u0643\u062A\u0645\u0644\u064B\u0627 \u0628\u0635\u064A\u063A\u0629 \u0645\u062F\u0639\u0648\u0645\u0629. \u0644\u0645 \u064A\u064F\u0639\u062A\u0645\u062F \u0623\u064A \u0634\u0631\u062D. \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627\u060C \u0648\u0625\u0630\u0627 \u062A\u0643\u0631\u0631 \u0627\u0644\u062E\u0637\u0623 \u0641\u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647."
    },
    {
      codes: ["invalid_response", "invalid_companion_response", "malformed_explanation"],
      en: "The returned explanation failed validation and was discarded. Try another available model; if it repeats, report the code below.",
      ar: "\u0644\u0645 \u064A\u062C\u062A\u0632 \u0627\u0644\u0634\u0631\u062D \u0627\u0644\u0645\u064F\u0639\u0627\u062F \u0627\u0644\u062A\u062D\u0642\u0642\u060C \u0641\u062A\u0645 \u062A\u062C\u0627\u0647\u0644\u0647. \u062C\u0631\u0651\u0628 \u0646\u0645\u0648\u0630\u062C\u064B\u0627 \u0622\u062E\u0631 \u0645\u062A\u0627\u062D\u064B\u0627\u060C \u0648\u0625\u0630\u0627 \u062A\u0643\u0631\u0631 \u0627\u0644\u062E\u0637\u0623 \u0641\u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647."
    },
    {
      codes: ["response_too_large", "stream_too_large", "explanation_too_large"],
      en: "The response exceeded the app\u2019s size limit and was discarded. Try another available model; if it repeats, report the code below.",
      ar: "\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0631\u062F \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u062D\u062C\u0645 \u0641\u064A \u0627\u0644\u062A\u0637\u0628\u064A\u0642\u060C \u0641\u062A\u0645 \u062A\u062C\u0627\u0647\u0644\u0647. \u062C\u0631\u0651\u0628 \u0646\u0645\u0648\u0630\u062C\u064B\u0627 \u0622\u062E\u0631 \u0645\u062A\u0627\u062D\u064B\u0627\u060C \u0648\u0625\u0630\u0627 \u062A\u0643\u0631\u0631 \u0627\u0644\u062E\u0637\u0623 \u0641\u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647."
    },
    {
      codes: ["stale_response", "account_changed"],
      en: "The position, preferences or account changed, so this request was discarded. Review the current position and request a new explanation when ready.",
      ar: "\u062A\u063A\u064A\u0651\u0631\u062A \u0627\u0644\u0648\u0636\u0639\u064A\u0629 \u0623\u0648 \u0627\u0644\u062A\u0641\u0636\u064A\u0644\u0627\u062A \u0623\u0648 \u0627\u0644\u062D\u0633\u0627\u0628\u060C \u0641\u062A\u0645 \u062A\u062C\u0627\u0647\u0644 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628. \u0631\u0627\u062C\u0639 \u0627\u0644\u0648\u0636\u0639\u064A\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0648\u0627\u0637\u0644\u0628 \u0634\u0631\u062D\u064B\u0627 \u062C\u062F\u064A\u062F\u064B\u0627 \u0639\u0646\u062F\u0645\u0627 \u062A\u0643\u0648\u0646 \u0645\u0633\u062A\u0639\u062F\u064B\u0627."
    },
    {
      codes: ["invalid_client"],
      en: "The app\u2019s client configuration was rejected. Verify the companion\u2019s extension ID in AI settings; if it matches, report the code below.",
      ar: "\u0631\u064F\u0641\u0636 \u0625\u0639\u062F\u0627\u062F \u0639\u0645\u064A\u0644 \u0627\u0644\u062A\u0637\u0628\u064A\u0642. \u062A\u062D\u0642\u0651\u0642 \u0645\u0646 \u062A\u0637\u0627\u0628\u0642 \u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0625\u0636\u0627\u0641\u0629 \u0644\u0644\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0645\u0631\u0627\u0641\u0642 \u0645\u0639 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A\u061B \u0648\u0625\u0630\u0627 \u0643\u0627\u0646 \u0645\u0637\u0627\u0628\u0642\u064B\u0627\u060C \u0641\u0623\u0631\u0633\u0644 \u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647."
    },
    {
      codes: ["invalid_origin"],
      en: "The companion rejected this extension connection. Restart it with the extension ID shown in AI settings.",
      ar: "\u0631\u0641\u0636 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u0645\u0631\u0627\u0641\u0642 \u0627\u062A\u0635\u0627\u0644 \u0647\u0630\u0647 \u0627\u0644\u0625\u0636\u0627\u0641\u0629. \u0623\u0639\u062F \u062A\u0634\u063A\u064A\u0644\u0647 \u0628\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0638\u0627\u0647\u0631 \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A."
    },
    {
      codes: ["unknown_error"],
      en: "The explanation failed for an unrecognized reason. Refresh this chess tab. If it happens again, report when it occurred and the code below.",
      ar: "\u062A\u0639\u0630\u0651\u0631 \u0627\u0644\u0634\u0631\u062D \u0644\u0633\u0628\u0628 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641. \u062D\u062F\u0651\u062B \u0639\u0644\u0627\u0645\u0629 \u062A\u0628\u0648\u064A\u0628 \u0627\u0644\u0634\u0637\u0631\u0646\u062C \u0647\u0630\u0647. \u0625\u0630\u0627 \u062A\u0643\u0631\u0631 \u0627\u0644\u062E\u0637\u0623\u060C \u0623\u0628\u0644\u063A \u0639\u0646 \u0648\u0642\u062A \u062D\u062F\u0648\u062B\u0647 \u0648\u0627\u0644\u0631\u0645\u0632 \u0623\u062F\u0646\u0627\u0647."
    }
  ];
  var MESSAGES = new Map(GROUPS.flatMap((group) => group.codes.map((code) => [code, group])));
  var ALIASES = /* @__PURE__ */ new Map([
    ["Extension context invalidated.", "extension_reloaded"],
    ["Extension context invalidated", "extension_reloaded"],
    ["Enable position sharing in extension settings first", "sharing_required"],
    ["Confirm local analysis or a built-in bot first", "practice_confirmation_required"],
    ["Training explanations are limited to local study, Chess.com analysis and the computer page", "unsupported_context"],
    ["Wait before requesting another explanation", "local_rate_limit"],
    ["Position changed", "stale_response"],
    ["Position changed; request discarded.", "stale_response"],
    ["Invalid companion response", "invalid_companion_response"],
    ["Companion unavailable or request timed out. Check the companion and try again.", "companion_unavailable"]
  ]);
  function explanationError(value, language = "en") {
    const candidates = typeof value === "string" ? [value] : [value?.code, value?.error, value?.message];
    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;
      const code = ALIASES.get(candidate) ?? candidate;
      if (MESSAGES.has(code)) return { code, message: MESSAGES.get(code)[language === "ar" ? "ar" : "en"] };
    }
    return { code: "unknown_error", message: MESSAGES.get("unknown_error")[language === "ar" ? "ar" : "en"] };
  }

  // src/content/training-panel.js
  var COPY = {
    en: { title: "Make this position a lesson", intro: "Take a moment to choose your move before asking for help.", rating: "Your playing level", budget: "Your thinking budget", seconds15: "15 seconds", seconds30: "30 seconds", minute1: "1 minute", minutes3: "3 minutes", minutes10: "10 minutes", weights: "Show simulated choice weights", estimateNote: "Complexity, thinking time and choice weights are estimates, not measured human behavior. Weights compare only these moves.", highlight: "Highlight a candidate", practice: "This is local analysis or a built-in bot", practiceHelp: "Page detection cannot reliably identify bots. Never use explanations against people. Check the FEN if the turn or castling rights are uncertain.", explain: "Explain position", explaining: "Explaining\u2026", account: "AI settings", privacy: "Optional explanations use your ChatGPT plan after consent. Only validated chess data and your training settings are shared.", local: "Local Stockfish works without signing in.", waiting: "Waiting for a valid local engine line.", changed: "Position or preferences changed. Explain when you\u2019re ready.", requesting: "Using your ChatGPT plan to explain these engine moves\u2026", complete: "Explanation of this snapshot. AI estimates may be wrong; compare them with the local engine.", low: "low", medium: "medium", high: "high", complexity: "Local complexity estimate", thinking: "Estimated thinking time", seconds: "seconds", simulated: "simulated", aiComplexity: "AI complexity estimate", threats: "Potential replies to watch", tradeoff: "Tradeoff", aiLanguage: "AI language", thinkingMode: "Thinking", en: "English", ar: "Arabic", default: "Model default", none: "None", minimal: "Minimal", xhigh: "Extra high", max: "Maximum", failure: "Explanation unavailable.", stillLocal: "Local analysis remains available." },
    ar: { title: "\u062D\u0648\u0651\u0644 \u0647\u0630\u0647 \u0627\u0644\u0648\u0636\u0639\u064A\u0629 \u0625\u0644\u0649 \u062F\u0631\u0633", intro: "\u062E\u0630 \u0644\u062D\u0638\u0629 \u0644\u0627\u062E\u062A\u064A\u0627\u0631 \u0646\u0642\u0644\u062A\u0643 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0629.", rating: "\u0645\u0633\u062A\u0648\u0627\u0643 \u0641\u064A \u0627\u0644\u0644\u0639\u0628", budget: "\u0648\u0642\u062A \u0627\u0644\u062A\u0641\u0643\u064A\u0631 \u0627\u0644\u0645\u062A\u0627\u062D", seconds15: "15 \u062B\u0627\u0646\u064A\u0629", seconds30: "30 \u062B\u0627\u0646\u064A\u0629", minute1: "\u062F\u0642\u064A\u0642\u0629 \u0648\u0627\u062D\u062F\u0629", minutes3: "3 \u062F\u0642\u0627\u0626\u0642", minutes10: "10 \u062F\u0642\u0627\u0626\u0642", weights: "\u0627\u0639\u0631\u0636 \u0623\u0648\u0632\u0627\u0646 \u0627\u062E\u062A\u064A\u0627\u0631 \u0645\u062D\u0627\u0643\u0627\u0629", estimateNote: "\u0627\u0644\u062A\u0639\u0642\u064A\u062F \u0648\u0648\u0642\u062A \u0627\u0644\u062A\u0641\u0643\u064A\u0631 \u0648\u0623\u0648\u0632\u0627\u0646 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631 \u062A\u0642\u062F\u064A\u0631\u0627\u062A\u060C \u0648\u0644\u064A\u0633\u062A \u0642\u064A\u0627\u0633\u0627\u062A \u0644\u0633\u0644\u0648\u0643 \u0627\u0644\u0628\u0634\u0631. \u062A\u0642\u0627\u0631\u0646 \u0627\u0644\u0623\u0648\u0632\u0627\u0646 \u0647\u0630\u0647 \u0627\u0644\u0646\u0642\u0644\u0627\u062A \u0641\u0642\u0637.", highlight: "\u0645\u064A\u0651\u0632 \u0646\u0642\u0644\u0629 \u0645\u0631\u0634\u062D\u0629", practice: "\u0647\u0630\u0627 \u062A\u062D\u0644\u064A\u0644 \u0645\u062D\u0644\u064A \u0623\u0648 \u062A\u062F\u0631\u064A\u0628 \u0645\u0639 \u0631\u0648\u0628\u0648\u062A \u0645\u062F\u0645\u062C", practiceHelp: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0644\u0627\u0643\u062A\u0634\u0627\u0641 \u0627\u0644\u0635\u0641\u062D\u0629 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0631\u0648\u0628\u0648\u062A\u0627\u062A \u0628\u0634\u0643\u0644 \u0645\u0648\u062B\u0648\u0642. \u0644\u0627 \u062A\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0634\u0631\u062D \u0636\u062F \u0623\u0634\u062E\u0627\u0635. \u062A\u062D\u0642\u0651\u0642 \u0645\u0646 FEN \u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u062F\u0648\u0631 \u0623\u0648 \u062D\u0642 \u0627\u0644\u062A\u0628\u064A\u064A\u062A \u063A\u064A\u0631 \u0645\u0624\u0643\u062F.", explain: "\u0627\u0634\u0631\u062D \u0627\u0644\u0648\u0636\u0639\u064A\u0629", explaining: "\u062C\u0627\u0631\u064D \u0627\u0644\u0634\u0631\u062D\u2026", account: "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A", privacy: "\u064A\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0634\u0631\u062D \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631\u064A \u062E\u0637\u0629 ChatGPT \u0628\u0639\u062F \u0645\u0648\u0627\u0641\u0642\u062A\u0643. \u062A\u064F\u0634\u0627\u0631\u0643 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0634\u0637\u0631\u0646\u062C \u0627\u0644\u0645\u062A\u062D\u0642\u0642 \u0645\u0646\u0647\u0627 \u0648\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062A\u062F\u0631\u064A\u0628 \u0641\u0642\u0637.", local: "\u064A\u0639\u0645\u0644 Stockfish \u0645\u062D\u0644\u064A\u064B\u0627 \u062F\u0648\u0646 \u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644.", waiting: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062E\u0637 \u0644\u0639\u0628 \u0635\u0627\u0644\u062D \u0645\u0646 \u0627\u0644\u0645\u062D\u0631\u0643 \u0627\u0644\u0645\u062D\u0644\u064A.", changed: "\u062A\u063A\u064A\u0651\u0631\u062A \u0627\u0644\u0648\u0636\u0639\u064A\u0629 \u0623\u0648 \u0627\u0644\u062A\u0641\u0636\u064A\u0644\u0627\u062A. \u0627\u0637\u0644\u0628 \u0627\u0644\u0634\u0631\u062D \u0639\u0646\u062F\u0645\u0627 \u062A\u0643\u0648\u0646 \u0645\u0633\u062A\u0639\u062F\u064B\u0627.", requesting: "\u062A\u064F\u0633\u062A\u062E\u062F\u0645 \u062E\u0637\u0629 ChatGPT \u0644\u0634\u0631\u062D \u0646\u0642\u0644\u0627\u062A \u0627\u0644\u0645\u062D\u0631\u0643 \u0647\u0630\u0647\u2026", complete: "\u0634\u0631\u062D \u0644\u0647\u0630\u0647 \u0627\u0644\u0644\u0642\u0637\u0629 \u0645\u0646 \u0627\u0644\u0648\u0636\u0639\u064A\u0629. \u0642\u062F \u062A\u062E\u0637\u0626 \u062A\u0642\u062F\u064A\u0631\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A\u061B \u0642\u0627\u0631\u0646\u0647\u0627 \u0628\u0627\u0644\u0645\u062D\u0631\u0643 \u0627\u0644\u0645\u062D\u0644\u064A.", low: "\u0645\u0646\u062E\u0641\u0636", medium: "\u0645\u062A\u0648\u0633\u0637", high: "\u0645\u0631\u062A\u0641\u0639", complexity: "\u062A\u0642\u062F\u064A\u0631 \u0627\u0644\u062A\u0639\u0642\u064A\u062F \u0627\u0644\u0645\u062D\u0644\u064A", thinking: "\u0648\u0642\u062A \u0627\u0644\u062A\u0641\u0643\u064A\u0631 \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u064A", seconds: "\u062B\u0627\u0646\u064A\u0629", simulated: "\u0645\u062D\u0627\u0643\u0627\u0629", aiComplexity: "\u062A\u0642\u062F\u064A\u0631 \u0627\u0644\u062A\u0639\u0642\u064A\u062F \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A", threats: "\u0631\u062F\u0648\u062F \u0645\u062D\u062A\u0645\u0644\u0629 \u062A\u0633\u062A\u062D\u0642 \u0627\u0644\u0627\u0646\u062A\u0628\u0627\u0647", tradeoff: "\u0627\u0644\u0645\u0642\u0627\u0628\u0644", aiLanguage: "\u0644\u063A\u0629 \u0627\u0644\u0634\u0631\u062D", thinkingMode: "\u0627\u0644\u062A\u0641\u0643\u064A\u0631", en: "\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629", ar: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", default: "\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u0627\u0644\u0646\u0645\u0648\u0630\u062C", none: "\u0628\u0644\u0627 \u062A\u0641\u0643\u064A\u0631 \u0625\u0636\u0627\u0641\u064A", minimal: "\u0623\u062F\u0646\u0649", xhigh: "\u0645\u0631\u062A\u0641\u0639 \u062C\u062F\u064B\u0627", max: "\u0623\u0642\u0635\u0649", failure: "\u0627\u0644\u0634\u0631\u062D \u063A\u064A\u0631 \u0645\u062A\u0627\u062D.", stillLocal: "\u064A\u0628\u0642\u0649 \u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u062D\u0644\u064A \u0645\u062A\u0627\u062D\u064B\u0627." }
  };
  var STYLE = `
.training{container:training / inline-size;margin-block-start:12px;border-block-start:1px solid #d3d9d0;padding:22px 24px 24px;background:#fffefb;color:#192b29;font:14px/1.6 "Segoe UI",Tahoma,Arial,sans-serif;user-select:text;border-radius:0 0 11px 11px;text-align:start}
.training *{box-sizing:border-box}.training h3{font-size:20px;font-weight:650;line-height:1.3;margin:0 0 7px;text-wrap:balance}.training p{margin:7px 0;text-wrap:pretty}.training .muted{color:#556460;font-size:13px}.training .fields{display:grid;grid-template-columns:1fr;gap:12px;margin-block:18px 10px}.training .field{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:650}.training select{inline-size:100%;max-inline-size:none;margin:0;min-block-size:48px;padding:8px 10px;border:1px solid #788781;border-radius:7px;color:#192b29;background:#fffefb;font:16px "Segoe UI",Tahoma,Arial,sans-serif}.training .check{display:flex;align-items:center;gap:9px;min-block-size:48px;line-height:1.5;cursor:pointer;margin:0;font-size:14px}.training input[type=checkbox]{accent-color:#17534a;inline-size:18px;block-size:18px;flex:none;margin:0}.training .estimate-note{font-size:12px;color:#556460;margin-block:4px 14px}.training .estimate{display:grid;gap:2px;background:#edf2e9;border:1px solid #b6c6b4;border-radius:8px;padding:11px 12px;color:#244d40;font-size:12px}.training .choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-block:10px 17px;direction:ltr}.training button{font:13px/1.4 "Segoe UI",Tahoma,Arial,sans-serif;cursor:pointer;min-block-size:48px;min-inline-size:0;border:1px solid #788781;border-radius:7px;background:#fffefb;color:#192b29;padding:10px 12px}.training button:hover{background:#edf2e9}.training button:focus-visible,.training input:focus-visible,.training select:focus-visible{outline:3px solid #073a8c;outline-offset:3px}.training button:disabled{opacity:.6;cursor:not-allowed}.training .choices button{padding:9px 5px;font-size:17px;font-weight:650;display:flex;flex-direction:column;align-items:center;gap:3px}.training .choices small{font-size:11px;font-weight:400;line-height:1.4}.training .choices button[aria-pressed=true]{border:2px solid #17534a;background:#e3ece0;color:#17534a;padding:8px 4px}.training .practice-note{font-size:12px;color:#556460;margin:0 0 14px}.training .actions{display:flex;gap:8px;flex-wrap:wrap}.training .primary{font-size:16px;background:#17534a;color:#fffefb;border-color:#17534a;font-weight:650;flex:1;min-inline-size:160px}.training .primary:hover{background:#103f37}.training .account{font-size:14px;flex:1}.training .ai-preferences{font-size:12px;color:#556460;margin-block:10px}.training .message{font-size:13px;color:#465a51;margin-block-start:12px}.training .message[data-error]{border-inline-start:3px solid #9b392d;padding-inline-start:10px;color:#822b20}.training .privacy{font-size:12px;color:#556460;margin-block:12px 0}.training .output{font-size:13px;overflow-wrap:anywhere}.training .output:not(:empty){border-block-start:1px solid #d3d9d0;margin-block-start:18px;padding-block-start:6px}.training .output h4{font-size:15px;margin:14px 0 5px;font-weight:650}.training .output p{margin:4px 0}.training .output .candidate-heading{direction:ltr;unicode-bidi:isolate;text-align:start;color:#17534a;font-size:18px}.training .output .tradeoff{color:#556460}.training [hidden]{display:none}
@container training (inline-size >= 300px){.training .fields{grid-template-columns:1fr 1fr}}
.training .error-code{display:block;margin-block-start:6px;font-size:12px}.training .error-code bdi{font-family:Consolas,monospace;overflow-wrap:anywhere}
@media(max-width:760px){.training{padding:20px 18px}}`;
  var TEMPLATE2 = `<section class="training">
  <h3 data-copy="title"></h3><p class="muted" data-copy="intro"></p>
  <div class="fields"><label class="field"><span data-copy="rating"></span><select class="rating" name="rating"><option>600</option><option>800</option><option>1000</option><option selected>1200</option><option>1400</option><option>1600</option><option>1800</option><option>2000</option><option>2400</option></select></label>
  <label class="field"><span data-copy="budget"></span><select class="budget" name="timeBudget"><option value="15" data-copy="seconds15"></option><option value="30" data-copy="seconds30"></option><option value="60" selected data-copy="minute1"></option><option value="180" data-copy="minutes3"></option><option value="600" data-copy="minutes10"></option></select></label></div>
  <label class="check"><input type="checkbox" class="weights" name="simulateWeights"><span data-copy="weights"></span></label>
  <p class="estimate-note" data-copy="estimateNote"></p><div class="estimate"></div><div class="choices"></div>
  <label class="check" data-agent-confirm="Confirms this position is local study or a built-in bot"><input type="checkbox" class="practice" name="practice"><span data-copy="practice"></span></label>
  <p class="practice-note" data-copy="practiceHelp"></p><p class="ai-preferences"></p>
  <div class="actions"><button type="button" class="primary explain" data-agent-confirm="Sends this chess position to the selected model using your ChatGPT plan" disabled></button><button type="button" class="account" data-copy="account"></button></div>
  <p class="privacy" data-copy="privacy"></p><p class="message" role="status" aria-live="polite"></p><div class="output"></div>
</section>`;
  var TrainingPanel = class {
    constructor(root, { onSelect = () => {
    }, verifyCurrent = () => true, send = (msg) => chrome.runtime.sendMessage(msg) } = {}) {
      const style = document.createElement("style");
      style.textContent = STYLE;
      root.append(style);
      this.el = document.createElement("div");
      this.el.innerHTML = TEMPLATE2;
      const target = root.querySelector(".body") ?? root;
      target.insertBefore(this.el, target.querySelector("details.main"));
      this.$ = (selector) => this.el.querySelector(selector);
      this.send = send;
      this.onSelect = onSelect;
      this.verifyCurrent = verifyCurrent;
      this.generation = new Generation();
      this.selected = null;
      this.data = null;
      this.allowed = false;
      this.busy = false;
      this.preferences = { uiLanguage: "en", explanationLanguage: "en", reasoningEffort: "default" };
      this.language = "en";
      this.messageKey = "local";
      this.translate();
      this.$(".account").onclick = () => this.send({ type: "training", action: "open-settings" });
      for (const selector of [".rating", ".budget", ".weights", ".practice"]) this.$(selector).onchange = () => {
        this.invalidate();
        this.refresh();
      };
      this.$(".explain").onclick = () => this.explain();
      readPreferences().then((preferences) => this.applyPreferences(preferences)).catch(() => {
      });
      this.stopPreferences = watchPreferences((preferences) => this.applyPreferences(preferences));
    }
    text(key) {
      return COPY[this.language][key] ?? COPY.en[key] ?? key;
    }
    applyPreferences(preferences) {
      if (JSON.stringify(this.preferences) === JSON.stringify(preferences)) return;
      this.preferences = preferences;
      this.language = preferences.uiLanguage;
      this.invalidate();
      this.translate();
      this.refresh();
    }
    translate() {
      this.$(".training").lang = this.language;
      this.$(".training").dir = this.language === "ar" ? "rtl" : "ltr";
      for (const el of this.el.querySelectorAll("[data-copy]")) el.textContent = this.text(el.dataset.copy);
      this.$(".choices").setAttribute("aria-label", this.text("highlight"));
      this.$(".message").textContent = this.text(this.messageKey);
      this.$(".ai-preferences").textContent = `${this.text("aiLanguage")}: ${this.text(this.preferences.explanationLanguage)} \xB7 ${this.text("thinkingMode")}: ${this.text(this.preferences.reasoningEffort)}`;
    }
    settings() {
      return { rating: +this.$(".rating").value, timeBudgetSeconds: +this.$(".budget").value, simulateWeights: this.$(".weights").checked, language: this.preferences.explanationLanguage, reasoningEffort: this.preferences.reasoningEffort };
    }
    message(key, error = false) {
      this.messageKey = key;
      this.$(".message").textContent = this.text(key);
      this.$(".message").toggleAttribute("data-error", error);
    }
    showError(value) {
      const error = explanationError(value, this.language), message = this.$(".message");
      this.messageKey = "failure";
      message.setAttribute("data-error", "");
      const text = document.createElement("span");
      text.textContent = `${error.message} ${this.text("stillLocal")}`;
      const detail = document.createElement("span");
      detail.className = "error-code";
      const code = document.createElement("bdi");
      code.dir = "ltr";
      code.lang = "en";
      code.textContent = error.code;
      detail.append(this.language === "ar" ? "\u0631\u0645\u0632 \u0627\u0644\u062A\u0634\u062E\u064A\u0635: " : "Diagnostic code: ", code);
      message.replaceChildren(text, detail);
    }
    invalidate() {
      this.generation.invalidate();
      this.busy = false;
      this.$(".output").replaceChildren();
      this.message("changed");
      try {
        this.send({ type: "training", action: "cancel-explanation" }).catch(() => {
        });
      } catch {
      }
    }
    update(position2, sorted, allowed) {
      const key = position2?.fen ?? "";
      const changed = key !== this.generation.key || allowed !== this.allowed;
      if (changed) {
        this.invalidate();
        this.generation.update(key);
        this.selected = null;
      }
      this.allowed = allowed;
      this.data = null;
      if (position2 && sorted.length) {
        try {
          this.data = validateTraining({ fen: position2.fen, sideToMove: position2.turn, candidates: sorted.slice(0, 3).map((l) => ({ move: l.moves[0].uci, score: { type: l.info.mate !== void 0 ? "mate" : "cp", value: l.info.mate ?? l.info.cp, perspective: "white" }, depth: l.info.depth, pv: l.moves.slice(0, 6).map((m) => m.uci) })), settings: this.settings() });
        } catch {
        }
      }
      this.refresh();
    }
    refresh() {
      const button = this.$(".explain");
      button.disabled = !this.data || !this.allowed || !this.$(".practice").checked || this.busy;
      button.textContent = this.text(this.busy ? "explaining" : "explain");
      if (!this.data) {
        this.choicesKey = null;
        this.$(".estimate").textContent = this.text("waiting");
        this.$(".choices").replaceChildren();
        return;
      }
      this.data.settings = this.settings();
      const estimate = estimateTraining(this.data);
      this.$(".estimate").replaceChildren(...[`${this.text("complexity")}: ${this.text(estimate.level)}.`, `${this.text("thinking")}: ${estimate.minSeconds}\u2013${estimate.maxSeconds} ${this.text("seconds")}.`].map((text) => {
        const span = document.createElement("span");
        span.textContent = text;
        return span;
      }));
      const keys = this.data.candidates.map((c) => c.move);
      if (!keys.includes(this.selected)) this.selected = keys[0];
      const choicesKey = JSON.stringify([keys, this.selected, estimate.weights, this.language]);
      if (choicesKey !== this.choicesKey) {
        const focused = (this.el.getRootNode().activeElement ?? document.activeElement)?.dataset?.candidateMove;
        this.choicesKey = choicesKey;
        this.$(".choices").replaceChildren(...this.data.candidates.map((c, i) => {
          const chess = new Chess(this.data.fen);
          const move2 = chess.move({ from: c.move.slice(0, 2), to: c.move.slice(2, 4), promotion: c.move[4] });
          const button2 = document.createElement("button");
          button2.type = "button";
          button2.textContent = move2.san;
          button2.dataset.candidateMove = c.move;
          button2.setAttribute("aria-pressed", String(c.move === this.selected));
          if (estimate.weights) {
            const weight = document.createElement("small");
            weight.textContent = `${estimate.weights[i].percent}% ${this.text("simulated")}`;
            button2.append(weight);
          }
          button2.onclick = () => {
            this.selected = c.move;
            this.refresh();
            this.onSelect(c.move);
          };
          return button2;
        }));
        if (focused) this.$(`.choices button[data-candidate-move="${focused}"]`)?.focus({ preventScroll: true });
      }
    }
    async explain() {
      if (this.$(".explain").disabled) return;
      const snapshot = structuredClone(this.data), generation = this.generation.id;
      this.busy = true;
      this.$(".output").replaceChildren();
      this.refresh();
      this.message("requesting");
      try {
        const response = await this.send({ type: "training", action: "explain", data: snapshot, confirmed: this.$(".practice").checked });
        if (!this.verifyCurrent()) {
          this.invalidate();
          this.refresh();
          return;
        }
        if (!this.generation.current(generation)) return;
        if (!response?.ok) throw response ?? new Error("invalid_response");
        let out;
        try {
          out = validateExplanation(response.explanation, snapshot);
        } catch {
          throw new Error("malformed_explanation");
        }
        const node2 = this.$(".output");
        node2.replaceChildren();
        node2.lang = snapshot.settings.language;
        node2.dir = snapshot.settings.language === "ar" ? "rtl" : "ltr";
        const outputText = (key) => COPY[snapshot.settings.language][key];
        const append = (tag, text, className = "") => {
          const e = document.createElement(tag);
          e.textContent = text;
          e.className = className;
          node2.append(e);
        };
        const san = (uci) => {
          const c = new Chess(snapshot.fen);
          return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
        };
        append("h4", `${outputText("aiComplexity")}: ${outputText(out.complexity.level)}`);
        append("p", out.complexity.reason);
        if (out.threats.length) {
          append("h4", outputText("threats"));
          for (const threat of out.threats) {
            const c = new Chess(snapshot.fen);
            c.move({ from: threat.candidateMove.slice(0, 2), to: threat.candidateMove.slice(2, 4), promotion: threat.candidateMove[4] });
            const reply = c.move({ from: threat.replyMove.slice(0, 2), to: threat.replyMove.slice(2, 4), promotion: threat.replyMove[4] }).san;
            append("p", `${san(threat.candidateMove)} \u2192 ${reply}: ${threat.description}`);
          }
        }
        for (const candidate of out.candidates) {
          append("h4", san(candidate.move), "candidate-heading");
          append("p", candidate.idea);
          append("p", `${outputText("tradeoff")}: ${candidate.tradeoff}`, "tradeoff");
        }
        this.message("complete");
      } catch (error) {
        if (this.generation.current(generation)) {
          this.showError(error);
        }
      } finally {
        if (this.generation.current(generation)) {
          this.busy = false;
          this.refresh();
        }
      }
    }
  };

  // src/content/index.js
  var DEFAULTS = {
    enabled: true,
    multipv: 3,
    depth: 10,
    turn: "auto",
    arrows: true,
    followMine: 1,
    colors: DEFAULT_COLORS,
    showOrder: true,
    followOpp: 0,
    onlyBottom: true,
    showAccuracy: true,
    collapsed: false,
    sections: { settings: false, analysis: true, arrows: true, general: true },
    opacity: 100,
    fairAck: null,
    pos: null,
    lang: "en"
  };
  var RESTART_KEYS = ["enabled", "multipv", "depth", "turn", "onlyBottom", "showAccuracy"];
  var LS_KEY = "chessHints.settings";
  var side = (c) => ({ k: `side.${c}` });
  var settings;
  var panel;
  var training;
  var overlay;
  var stopLanguageWatch;
  var current = null;
  var position = null;
  var lastKey = null;
  var forceArrows = false;
  var forceTimer = null;
  var FORCE_ARROWS_MS = 3e3;
  var readTimer = null;
  var renderQueued = false;
  var jobId = 0;
  var lines = /* @__PURE__ */ new Map();
  var port = null;
  var engineReady = false;
  var connecting = false;
  var dead = false;
  var liveKey = null;
  var liveNow = false;
  var liveOverride = false;
  var autoDisabled = false;
  var tracker = new CastleTracker();
  var accuracy = new AccuracyTracker();
  var silent = false;
  var alive = () => {
    try {
      return !!chrome.runtime.id;
    } catch (_) {
      return false;
    }
  };
  async function connectEngine() {
    if (dead || port || connecting) return;
    connecting = true;
    try {
      const res = await chrome.runtime.sendMessage({ type: "ensure-engine" });
      if (!res || !res.ok) throw new Error(res && res.error || "engine");
      port = chrome.runtime.connect({ name: "analysis" });
      port.onMessage.addListener(onEngineMessage);
      port.onDisconnect.addListener(() => {
        void chrome.runtime.lastError;
        port = null;
        engineReady = false;
        setTimeout(connectEngine, 1e3);
      });
    } catch (_) {
      if (!alive()) return shutdown();
      setTimeout(connectEngine, 2e3);
    } finally {
      connecting = false;
    }
  }
  function onEngineMessage(msg) {
    if (msg.type === "ready") {
      engineReady = true;
      requestAnalysis();
    } else if (msg.type === "info" && msg.id === jobId && position) {
      if (msg.multipv === 1) {
        accuracy.onEval(position.fen, msg);
        scheduleRender();
      }
      if (silent) return;
      const { moves } = pvToSan(position.fen, msg.pv);
      if (!moves.length) return;
      lines.set(msg.multipv, { info: msg, moves });
      scheduleRender();
    }
  }
  function stopAnalysis() {
    jobId++;
    lines = /* @__PURE__ */ new Map();
    if (port && engineReady) port.postMessage({ type: "stop" });
  }
  function requestAnalysis() {
    if (!position) return;
    stopAnalysis();
    silent = false;
    render();
    const background = !settings.enabled;
    if (background) {
      panel.status(liveNow ? "status.liveOff" : "status.off");
      if (!settings.showAccuracy || liveNow) return;
      silent = true;
    }
    if (position.over) {
      const lost = position.turn === "w" ? -1 : 1;
      accuracy.onEval(position.fen, position.over === "mate" ? { mate: lost, depth: 99 } : { cp: 0, depth: 99 });
      render();
      if (!background) panel.status(`status.${position.over}`);
      return;
    }
    const bottomTurn = position.orientation === "white" ? "w" : "b";
    if (settings.onlyBottom && position.turn !== bottomTurn) {
      if (!background) panel.status("status.opponent", { side: side(position.turn) });
      if (!settings.showAccuracy) return;
      silent = true;
    } else if (!background) {
      panel.status(position.source === "assumed" ? "status.turnAssumed" : "status.turn", {
        site: current.adapter.name,
        side: side(position.turn)
      });
    }
    if (!engineReady) {
      connectEngine();
      return;
    }
    port.postMessage({
      type: "analyze",
      id: jobId,
      fen: position.fen,
      multipv: silent ? 1 : settings.multipv,
      depth: settings.depth
    });
  }
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }
  function render() {
    const hideStats = liveNow && !settings.enabled;
    panel.accuracy(settings.showAccuracy && !hideStats ? accuracy.summary() : null);
    const sorted = [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v).slice(0, 3);
    training?.update(position, sorted, trainingContext(location.href) && !liveNow && settings.enabled && !silent);
    const view = sorted.map((l) => ({
      san: l.moves[0].san,
      scoreText: formatScore(l.info),
      ...summarizeLine(l.moves, position.turn),
      depth: l.info.depth,
      percent: whitePercent(l.info)
    }));
    panel.results(view);
    if ((settings.arrows || forceArrows) && position && sorted.length) {
      const arrows = [];
      sorted.forEach((l, i) => {
        if (l.moves[0].uci !== (training?.selected || sorted[0].moves[0].uci)) return;
        let n = 0;
        l.moves.forEach((m, ply) => {
          const limit = ply % 2 ? settings.followOpp : settings.followMine;
          if (ply === 0) {
            arrows.push({ from: sqIndex(m.from), to: sqIndex(m.to), rank: i, ply, n: ++n });
          }
        });
      });
      overlay.draw(arrows, position.orientation, settings.showOrder, settings.colors);
    } else {
      overlay.clear();
    }
  }
  function syncOverlay() {
    if (!current || !current.el.isConnected || !(settings.arrows || forceArrows)) return overlay.place(null);
    overlay.place(current.el.getBoundingClientRect());
  }
  function schedule(delay) {
    clearTimeout(readTimer);
    readTimer = setTimeout(readNow, delay);
  }
  function readNow() {
    if (dead || !current) return;
    let raw;
    try {
      raw = current.adapter.read(current.el);
    } catch (_) {
      return;
    }
    if (!raw) {
      position = null;
      lastKey = null;
      stopAnalysis();
      render();
      return;
    }
    if (raw.dragging) return schedule(200);
    const res = resolvePosition(raw, tracker, { turnOverride: settings.turn });
    if (res.error) {
      panel.status(res.error, null, true);
      position = null;
      lastKey = null;
      stopAnalysis();
      render();
      return;
    }
    const key = res.fen;
    if (key === lastKey) {
      if (position && position.orientation !== raw.orientation) {
        position.orientation = raw.orientation;
        render();
      }
      return;
    }
    lastKey = key;
    accuracy.onPosition(res.fen);
    position = { ...res, orientation: raw.orientation };
    requestAnalysis();
  }
  function bind(found) {
    unbind();
    current = { adapter: found.adapter, el: found.el, observer: null };
    tracker.reset();
    accuracy.reset();
    lastKey = null;
    const observer = new MutationObserver(() => schedule(150));
    observer.observe(found.el, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style"] });
    const wrap = found.el.closest(".cg-wrap") || found.el.parentElement;
    if (wrap) observer.observe(wrap, { attributes: true, attributeFilter: ["class"] });
    current.observer = observer;
    panel.status("status.detected", { site: found.adapter.name });
    schedule(0);
  }
  function unbind() {
    if (!current) return;
    current.observer.disconnect();
    current = null;
    position = null;
    lastKey = null;
    accuracy.reset();
    stopAnalysis();
    render();
    overlay.place(null);
    panel.status("status.noBoard");
  }
  function checkLive() {
    const key = location.host + location.pathname;
    const { live } = detectLive(location, document);
    const keyChanged = key !== liveKey;
    if (keyChanged) {
      liveKey = key;
      liveOverride = false;
    }
    if (!keyChanged && live === liveNow) return;
    liveNow = live;
    panel.live(live);
    if (live) {
      if (settings.enabled && !liveOverride) {
        autoDisabled = true;
        panel.set({ enabled: false });
      }
    } else if (autoDisabled) {
      autoDisabled = false;
      panel.set({ enabled: true });
    }
    lastKey = null;
    schedule(0);
  }
  function scan() {
    if (!alive()) return shutdown();
    checkLive();
    const found = pickBoard();
    if (!found) {
      if (current) unbind();
      return;
    }
    if (!current || current.el !== found.el || !current.el.isConnected) bind(found);
    else schedule(0);
  }
  function readLocalSettings() {
    try {
      const v = JSON.parse(localStorage.getItem(LS_KEY));
      return v && typeof v === "object" ? v : {};
    } catch (_) {
      return {};
    }
  }
  async function loadSettings() {
    let fromChrome = {};
    try {
      fromChrome = (await chrome.storage.local.get("settings")).settings || {};
    } catch (_) {
    }
    const fromLocal = readLocalSettings();
    return (fromLocal.savedAt || 0) > (fromChrome.savedAt || 0) ? fromLocal : fromChrome;
  }
  function saveSettings() {
    settings.savedAt = Date.now();
    try {
      chrome.storage.local.set({ settings });
    } catch (_) {
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(settings));
    } catch (_) {
    }
  }
  function sharedLanguage(preferences) {
    const language = preferences?.uiLanguage;
    return language === "en" || language === "ar" ? language : null;
  }
  function watchLanguage() {
    const listener = (changes, area) => {
      if (area !== "local" || !changes.trainingPreferences) return;
      const change = changes.trainingPreferences;
      const language = sharedLanguage(change.newValue);
      if (!language || language === sharedLanguage(change.oldValue) || language === settings.lang) return;
      settings.lang = language;
      setLang(language);
      saveSettings();
      panel.applyLang();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  function onSettingsChange(patch) {
    saveSettings();
    const keys = Object.keys(patch);
    if (keys.includes("lang") && sharedLanguage({ uiLanguage: settings.lang })) {
      savePreferences({ uiLanguage: settings.lang }).catch(() => {
      });
    }
    if (keys.includes("enabled") && !settings.enabled && settings.sections.settings) {
      panel.set({ sections: { ...settings.sections, settings: false } });
    }
    if (keys.includes("enabled") && settings.enabled) {
      if (liveNow) liveOverride = true;
      autoDisabled = false;
    }
    if (keys.some((k) => RESTART_KEYS.includes(k))) {
      lastKey = null;
      schedule(0);
    } else if (keys.includes("arrows") || keys.includes("showOrder") || keys.includes("colors") || keys.includes("followMine") || keys.includes("followOpp")) {
      render();
    }
  }
  function onHint() {
    if (!settings.enabled || settings.arrows) return;
    forceArrows = true;
    clearTimeout(forceTimer);
    forceTimer = setTimeout(() => {
      forceArrows = false;
      render();
      syncOverlay();
    }, FORCE_ARROWS_MS);
    render();
    syncOverlay();
  }
  function onReset() {
    const language = settings.lang;
    for (const k of Object.keys(settings)) delete settings[k];
    Object.assign(settings, DEFAULTS, { lang: language, colors: [...DEFAULT_COLORS], sections: { ...DEFAULTS.sections } });
    setLang(settings.lang);
    saveSettings();
    panel.applyPosition();
    panel.applyLang();
    lastKey = null;
    schedule(0);
  }
  function shutdown() {
    if (dead) return;
    dead = true;
    clearInterval(scanTimer);
    clearInterval(overlayTimer);
    stopLanguageWatch?.();
    training?.stopPreferences?.();
    if (current) current.observer.disconnect();
    if (port) port.disconnect();
    panel && panel.destroy();
    overlay && overlay.destroy();
  }
  var scanTimer;
  var overlayTimer;
  async function main() {
    if (window.top !== window) return;
    settings = { ...DEFAULTS, ...await loadSettings() };
    settings.sections = { ...DEFAULTS.sections, ...settings.sections };
    settings.colors = normalizeColors(settings.colors);
    settings.multipv = Math.min(3, Math.max(1, settings.multipv | 0));
    if (settings.colors[0] === "#15a34a") settings.colors[0] = DEFAULT_COLORS[0];
    settings.opacity = Math.min(100, Math.max(40, Math.round(+settings.opacity) || DEFAULTS.opacity));
    if (!LANGS[settings.lang]) settings.lang = detectLang();
    try {
      const { trainingPreferences } = await chrome.storage.local.get("trainingPreferences");
      settings.lang = sharedLanguage(trainingPreferences) ?? settings.lang;
    } catch (_) {
    }
    setLang(settings.lang);
    settings.enabled = true;
    overlay = new Overlay();
    panel = new Panel(settings, onSettingsChange, onHint, onReset);
    training = new TrainingPanel(panel.root, { onSelect: render, verifyCurrent: () => {
      readNow();
      try {
        return !!current?.el.isConnected && !!position && !current.adapter.read(current.el)?.dragging;
      } catch {
        return false;
      }
    } });
    panel.status("status.searching");
    stopLanguageWatch = watchLanguage();
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "toggle-panel") panel.toggleVisible();
    });
    scanTimer = setInterval(scan, 1e3);
    overlayTimer = setInterval(syncOverlay, 250);
    window.addEventListener("resize", syncOverlay, { passive: true });
    window.addEventListener("scroll", syncOverlay, { passive: true, capture: true });
    scan();
    connectEngine();
  }
  main();
})();
/*! Bundled license information:

chess.js/dist/esm/chess.js:
  (**
   * @license
   * Copyright (c) 2025, Jeff Hlywa (jhlywa@gmail.com)
   * All rights reserved.
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions are met:
   *
   * 1. Redistributions of source code must retain the above copyright notice,
   *    this list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright notice,
   *    this list of conditions and the following disclaimer in the documentation
   *    and/or other materials provided with the distribution.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
   * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
   * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
   * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
   * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
   * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
   * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
   * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
   * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
   * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
   * POSSIBILITY OF SUCH DAMAGE.
   *)
*/
