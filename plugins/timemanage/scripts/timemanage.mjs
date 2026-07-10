#!/usr/bin/env node
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/commander/lib/error.js
var require_error = __commonJS({
  "node_modules/commander/lib/error.js"(exports) {
    var CommanderError2 = class extends Error {
      /**
       * Constructs the CommanderError class
       * @param {number} exitCode suggested exit code which could be used with process.exit
       * @param {string} code an id string representing the error
       * @param {string} message human-readable description of the error
       */
      constructor(exitCode, code, message) {
        super(message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.code = code;
        this.exitCode = exitCode;
        this.nestedError = void 0;
      }
    };
    var InvalidArgumentError2 = class extends CommanderError2 {
      /**
       * Constructs the InvalidArgumentError class
       * @param {string} [message] explanation of why argument is invalid
       */
      constructor(message) {
        super(1, "commander.invalidArgument", message);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
      }
    };
    exports.CommanderError = CommanderError2;
    exports.InvalidArgumentError = InvalidArgumentError2;
  }
});

// node_modules/commander/lib/argument.js
var require_argument = __commonJS({
  "node_modules/commander/lib/argument.js"(exports) {
    var { InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var Argument2 = class {
      /**
       * Initialize a new command argument with the given name and description.
       * The default is that the argument is required, and you can explicitly
       * indicate this with <> around the name. Put [] around the name for an optional argument.
       *
       * @param {string} name
       * @param {string} [description]
       */
      constructor(name, description) {
        this.description = description || "";
        this.variadic = false;
        this.parseArg = void 0;
        this.defaultValue = void 0;
        this.defaultValueDescription = void 0;
        this.argChoices = void 0;
        switch (name[0]) {
          case "<":
            this.required = true;
            this._name = name.slice(1, -1);
            break;
          case "[":
            this.required = false;
            this._name = name.slice(1, -1);
            break;
          default:
            this.required = true;
            this._name = name;
            break;
        }
        if (this._name.endsWith("...")) {
          this.variadic = true;
          this._name = this._name.slice(0, -3);
        }
      }
      /**
       * Return argument name.
       *
       * @return {string}
       */
      name() {
        return this._name;
      }
      /**
       * @package
       */
      _collectValue(value, previous) {
        if (previous === this.defaultValue || !Array.isArray(previous)) {
          return [value];
        }
        previous.push(value);
        return previous;
      }
      /**
       * Set the default value, and optionally supply the description to be displayed in the help.
       *
       * @param {*} value
       * @param {string} [description]
       * @return {Argument}
       */
      default(value, description) {
        this.defaultValue = value;
        this.defaultValueDescription = description;
        return this;
      }
      /**
       * Set the custom handler for processing CLI command arguments into argument values.
       *
       * @param {Function} [fn]
       * @return {Argument}
       */
      argParser(fn) {
        this.parseArg = fn;
        return this;
      }
      /**
       * Only allow argument value to be one of choices.
       *
       * @param {string[]} values
       * @return {Argument}
       */
      choices(values) {
        this.argChoices = values.slice();
        this.parseArg = (arg, previous) => {
          if (!this.argChoices.includes(arg)) {
            throw new InvalidArgumentError2(
              `Allowed choices are ${this.argChoices.join(", ")}.`
            );
          }
          if (this.variadic) {
            return this._collectValue(arg, previous);
          }
          return arg;
        };
        return this;
      }
      /**
       * Make argument required.
       *
       * @returns {Argument}
       */
      argRequired() {
        this.required = true;
        return this;
      }
      /**
       * Make argument optional.
       *
       * @returns {Argument}
       */
      argOptional() {
        this.required = false;
        return this;
      }
    };
    function humanReadableArgName(arg) {
      const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
      return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
    }
    exports.Argument = Argument2;
    exports.humanReadableArgName = humanReadableArgName;
  }
});

// node_modules/commander/lib/help.js
var require_help = __commonJS({
  "node_modules/commander/lib/help.js"(exports) {
    var { humanReadableArgName } = require_argument();
    var Help2 = class {
      constructor() {
        this.helpWidth = void 0;
        this.minWidthToWrap = 40;
        this.sortSubcommands = false;
        this.sortOptions = false;
        this.showGlobalOptions = false;
      }
      /**
       * prepareContext is called by Commander after applying overrides from `Command.configureHelp()`
       * and just before calling `formatHelp()`.
       *
       * Commander just uses the helpWidth and the rest is provided for optional use by more complex subclasses.
       *
       * @param {{ error?: boolean, helpWidth?: number, outputHasColors?: boolean }} contextOptions
       */
      prepareContext(contextOptions) {
        this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
      }
      /**
       * Get an array of the visible subcommands. Includes a placeholder for the implicit help command, if there is one.
       *
       * @param {Command} cmd
       * @returns {Command[]}
       */
      visibleCommands(cmd) {
        const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
        const helpCommand = cmd._getHelpCommand();
        if (helpCommand && !helpCommand._hidden) {
          visibleCommands.push(helpCommand);
        }
        if (this.sortSubcommands) {
          visibleCommands.sort((a, b) => {
            return a.name().localeCompare(b.name());
          });
        }
        return visibleCommands;
      }
      /**
       * Compare options for sort.
       *
       * @param {Option} a
       * @param {Option} b
       * @returns {number}
       */
      compareOptions(a, b) {
        const getSortKey = (option) => {
          return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
        };
        return getSortKey(a).localeCompare(getSortKey(b));
      }
      /**
       * Get an array of the visible options. Includes a placeholder for the implicit help option, if there is one.
       *
       * @param {Command} cmd
       * @returns {Option[]}
       */
      visibleOptions(cmd) {
        const visibleOptions = cmd.options.filter((option) => !option.hidden);
        const helpOption = cmd._getHelpOption();
        if (helpOption && !helpOption.hidden) {
          const removeShort = helpOption.short && cmd._findOption(helpOption.short);
          const removeLong = helpOption.long && cmd._findOption(helpOption.long);
          if (!removeShort && !removeLong) {
            visibleOptions.push(helpOption);
          } else if (helpOption.long && !removeLong) {
            visibleOptions.push(
              cmd.createOption(helpOption.long, helpOption.description)
            );
          } else if (helpOption.short && !removeShort) {
            visibleOptions.push(
              cmd.createOption(helpOption.short, helpOption.description)
            );
          }
        }
        if (this.sortOptions) {
          visibleOptions.sort(this.compareOptions);
        }
        return visibleOptions;
      }
      /**
       * Get an array of the visible global options. (Not including help.)
       *
       * @param {Command} cmd
       * @returns {Option[]}
       */
      visibleGlobalOptions(cmd) {
        if (!this.showGlobalOptions) return [];
        const globalOptions = [];
        for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
          const visibleOptions = ancestorCmd.options.filter(
            (option) => !option.hidden
          );
          globalOptions.push(...visibleOptions);
        }
        if (this.sortOptions) {
          globalOptions.sort(this.compareOptions);
        }
        return globalOptions;
      }
      /**
       * Get an array of the arguments if any have a description.
       *
       * @param {Command} cmd
       * @returns {Argument[]}
       */
      visibleArguments(cmd) {
        if (cmd._argsDescription) {
          cmd.registeredArguments.forEach((argument) => {
            argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
          });
        }
        if (cmd.registeredArguments.find((argument) => argument.description)) {
          return cmd.registeredArguments;
        }
        return [];
      }
      /**
       * Get the command term to show in the list of subcommands.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      subcommandTerm(cmd) {
        const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
        return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + // simplistic check for non-help option
        (args ? " " + args : "");
      }
      /**
       * Get the option term to show in the list of options.
       *
       * @param {Option} option
       * @returns {string}
       */
      optionTerm(option) {
        return option.flags;
      }
      /**
       * Get the argument term to show in the list of arguments.
       *
       * @param {Argument} argument
       * @returns {string}
       */
      argumentTerm(argument) {
        return argument.name();
      }
      /**
       * Get the longest command term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestSubcommandTermLength(cmd, helper) {
        return helper.visibleCommands(cmd).reduce((max, command) => {
          return Math.max(
            max,
            this.displayWidth(
              helper.styleSubcommandTerm(helper.subcommandTerm(command))
            )
          );
        }, 0);
      }
      /**
       * Get the longest option term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestOptionTermLength(cmd, helper) {
        return helper.visibleOptions(cmd).reduce((max, option) => {
          return Math.max(
            max,
            this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option)))
          );
        }, 0);
      }
      /**
       * Get the longest global option term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestGlobalOptionTermLength(cmd, helper) {
        return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
          return Math.max(
            max,
            this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option)))
          );
        }, 0);
      }
      /**
       * Get the longest argument term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      longestArgumentTermLength(cmd, helper) {
        return helper.visibleArguments(cmd).reduce((max, argument) => {
          return Math.max(
            max,
            this.displayWidth(
              helper.styleArgumentTerm(helper.argumentTerm(argument))
            )
          );
        }, 0);
      }
      /**
       * Get the command usage to be displayed at the top of the built-in help.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      commandUsage(cmd) {
        let cmdName = cmd._name;
        if (cmd._aliases[0]) {
          cmdName = cmdName + "|" + cmd._aliases[0];
        }
        let ancestorCmdNames = "";
        for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
          ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
        }
        return ancestorCmdNames + cmdName + " " + cmd.usage();
      }
      /**
       * Get the description for the command.
       *
       * @param {Command} cmd
       * @returns {string}
       */
      commandDescription(cmd) {
        return cmd.description();
      }
      /**
       * Get the subcommand summary to show in the list of subcommands.
       * (Fallback to description for backwards compatibility.)
       *
       * @param {Command} cmd
       * @returns {string}
       */
      subcommandDescription(cmd) {
        return cmd.summary() || cmd.description();
      }
      /**
       * Get the option description to show in the list of options.
       *
       * @param {Option} option
       * @return {string}
       */
      optionDescription(option) {
        const extraInfo = [];
        if (option.argChoices) {
          extraInfo.push(
            // use stringify to match the display of the default value
            `choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
          );
        }
        if (option.defaultValue !== void 0) {
          const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
          if (showDefault) {
            extraInfo.push(
              `default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`
            );
          }
        }
        if (option.presetArg !== void 0 && option.optional) {
          extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
        }
        if (option.envVar !== void 0) {
          extraInfo.push(`env: ${option.envVar}`);
        }
        if (extraInfo.length > 0) {
          const extraDescription = `(${extraInfo.join(", ")})`;
          if (option.description) {
            return `${option.description} ${extraDescription}`;
          }
          return extraDescription;
        }
        return option.description;
      }
      /**
       * Get the argument description to show in the list of arguments.
       *
       * @param {Argument} argument
       * @return {string}
       */
      argumentDescription(argument) {
        const extraInfo = [];
        if (argument.argChoices) {
          extraInfo.push(
            // use stringify to match the display of the default value
            `choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
          );
        }
        if (argument.defaultValue !== void 0) {
          extraInfo.push(
            `default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`
          );
        }
        if (extraInfo.length > 0) {
          const extraDescription = `(${extraInfo.join(", ")})`;
          if (argument.description) {
            return `${argument.description} ${extraDescription}`;
          }
          return extraDescription;
        }
        return argument.description;
      }
      /**
       * Format a list of items, given a heading and an array of formatted items.
       *
       * @param {string} heading
       * @param {string[]} items
       * @param {Help} helper
       * @returns string[]
       */
      formatItemList(heading, items, helper) {
        if (items.length === 0) return [];
        return [helper.styleTitle(heading), ...items, ""];
      }
      /**
       * Group items by their help group heading.
       *
       * @param {Command[] | Option[]} unsortedItems
       * @param {Command[] | Option[]} visibleItems
       * @param {Function} getGroup
       * @returns {Map<string, Command[] | Option[]>}
       */
      groupItems(unsortedItems, visibleItems, getGroup) {
        const result = /* @__PURE__ */ new Map();
        unsortedItems.forEach((item) => {
          const group = getGroup(item);
          if (!result.has(group)) result.set(group, []);
        });
        visibleItems.forEach((item) => {
          const group = getGroup(item);
          if (!result.has(group)) {
            result.set(group, []);
          }
          result.get(group).push(item);
        });
        return result;
      }
      /**
       * Generate the built-in help text.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {string}
       */
      formatHelp(cmd, helper) {
        const termWidth = helper.padWidth(cmd, helper);
        const helpWidth = helper.helpWidth ?? 80;
        function callFormatItem(term, description) {
          return helper.formatItem(term, termWidth, description, helper);
        }
        let output = [
          `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
          ""
        ];
        const commandDescription = helper.commandDescription(cmd);
        if (commandDescription.length > 0) {
          output = output.concat([
            helper.boxWrap(
              helper.styleCommandDescription(commandDescription),
              helpWidth
            ),
            ""
          ]);
        }
        const argumentList = helper.visibleArguments(cmd).map((argument) => {
          return callFormatItem(
            helper.styleArgumentTerm(helper.argumentTerm(argument)),
            helper.styleArgumentDescription(helper.argumentDescription(argument))
          );
        });
        output = output.concat(
          this.formatItemList("Arguments:", argumentList, helper)
        );
        const optionGroups = this.groupItems(
          cmd.options,
          helper.visibleOptions(cmd),
          (option) => option.helpGroupHeading ?? "Options:"
        );
        optionGroups.forEach((options, group) => {
          const optionList = options.map((option) => {
            return callFormatItem(
              helper.styleOptionTerm(helper.optionTerm(option)),
              helper.styleOptionDescription(helper.optionDescription(option))
            );
          });
          output = output.concat(this.formatItemList(group, optionList, helper));
        });
        if (helper.showGlobalOptions) {
          const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
            return callFormatItem(
              helper.styleOptionTerm(helper.optionTerm(option)),
              helper.styleOptionDescription(helper.optionDescription(option))
            );
          });
          output = output.concat(
            this.formatItemList("Global Options:", globalOptionList, helper)
          );
        }
        const commandGroups = this.groupItems(
          cmd.commands,
          helper.visibleCommands(cmd),
          (sub) => sub.helpGroup() || "Commands:"
        );
        commandGroups.forEach((commands, group) => {
          const commandList = commands.map((sub) => {
            return callFormatItem(
              helper.styleSubcommandTerm(helper.subcommandTerm(sub)),
              helper.styleSubcommandDescription(helper.subcommandDescription(sub))
            );
          });
          output = output.concat(this.formatItemList(group, commandList, helper));
        });
        return output.join("\n");
      }
      /**
       * Return display width of string, ignoring ANSI escape sequences. Used in padding and wrapping calculations.
       *
       * @param {string} str
       * @returns {number}
       */
      displayWidth(str) {
        return stripColor(str).length;
      }
      /**
       * Style the title for displaying in the help. Called with 'Usage:', 'Options:', etc.
       *
       * @param {string} str
       * @returns {string}
       */
      styleTitle(str) {
        return str;
      }
      styleUsage(str) {
        return str.split(" ").map((word) => {
          if (word === "[options]") return this.styleOptionText(word);
          if (word === "[command]") return this.styleSubcommandText(word);
          if (word[0] === "[" || word[0] === "<")
            return this.styleArgumentText(word);
          return this.styleCommandText(word);
        }).join(" ");
      }
      styleCommandDescription(str) {
        return this.styleDescriptionText(str);
      }
      styleOptionDescription(str) {
        return this.styleDescriptionText(str);
      }
      styleSubcommandDescription(str) {
        return this.styleDescriptionText(str);
      }
      styleArgumentDescription(str) {
        return this.styleDescriptionText(str);
      }
      styleDescriptionText(str) {
        return str;
      }
      styleOptionTerm(str) {
        return this.styleOptionText(str);
      }
      styleSubcommandTerm(str) {
        return str.split(" ").map((word) => {
          if (word === "[options]") return this.styleOptionText(word);
          if (word[0] === "[" || word[0] === "<")
            return this.styleArgumentText(word);
          return this.styleSubcommandText(word);
        }).join(" ");
      }
      styleArgumentTerm(str) {
        return this.styleArgumentText(str);
      }
      styleOptionText(str) {
        return str;
      }
      styleArgumentText(str) {
        return str;
      }
      styleSubcommandText(str) {
        return str;
      }
      styleCommandText(str) {
        return str;
      }
      /**
       * Calculate the pad width from the maximum term length.
       *
       * @param {Command} cmd
       * @param {Help} helper
       * @returns {number}
       */
      padWidth(cmd, helper) {
        return Math.max(
          helper.longestOptionTermLength(cmd, helper),
          helper.longestGlobalOptionTermLength(cmd, helper),
          helper.longestSubcommandTermLength(cmd, helper),
          helper.longestArgumentTermLength(cmd, helper)
        );
      }
      /**
       * Detect manually wrapped and indented strings by checking for line break followed by whitespace.
       *
       * @param {string} str
       * @returns {boolean}
       */
      preformatted(str) {
        return /\n[^\S\r\n]/.test(str);
      }
      /**
       * Format the "item", which consists of a term and description. Pad the term and wrap the description, indenting the following lines.
       *
       * So "TTT", 5, "DDD DDDD DD DDD" might be formatted for this.helpWidth=17 like so:
       *   TTT  DDD DDDD
       *        DD DDD
       *
       * @param {string} term
       * @param {number} termWidth
       * @param {string} description
       * @param {Help} helper
       * @returns {string}
       */
      formatItem(term, termWidth, description, helper) {
        const itemIndent = 2;
        const itemIndentStr = " ".repeat(itemIndent);
        if (!description) return itemIndentStr + term;
        const paddedTerm = term.padEnd(
          termWidth + term.length - helper.displayWidth(term)
        );
        const spacerWidth = 2;
        const helpWidth = this.helpWidth ?? 80;
        const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
        let formattedDescription;
        if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
          formattedDescription = description;
        } else {
          const wrappedDescription = helper.boxWrap(description, remainingWidth);
          formattedDescription = wrappedDescription.replace(
            /\n/g,
            "\n" + " ".repeat(termWidth + spacerWidth)
          );
        }
        return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
      }
      /**
       * Wrap a string at whitespace, preserving existing line breaks.
       * Wrapping is skipped if the width is less than `minWidthToWrap`.
       *
       * @param {string} str
       * @param {number} width
       * @returns {string}
       */
      boxWrap(str, width) {
        if (width < this.minWidthToWrap) return str;
        const rawLines = str.split(/\r\n|\n/);
        const chunkPattern = /[\s]*[^\s]+/g;
        const wrappedLines = [];
        rawLines.forEach((line) => {
          const chunks = line.match(chunkPattern);
          if (chunks === null) {
            wrappedLines.push("");
            return;
          }
          let sumChunks = [chunks.shift()];
          let sumWidth = this.displayWidth(sumChunks[0]);
          chunks.forEach((chunk) => {
            const visibleWidth = this.displayWidth(chunk);
            if (sumWidth + visibleWidth <= width) {
              sumChunks.push(chunk);
              sumWidth += visibleWidth;
              return;
            }
            wrappedLines.push(sumChunks.join(""));
            const nextChunk = chunk.trimStart();
            sumChunks = [nextChunk];
            sumWidth = this.displayWidth(nextChunk);
          });
          wrappedLines.push(sumChunks.join(""));
        });
        return wrappedLines.join("\n");
      }
    };
    function stripColor(str) {
      const sgrPattern = /\x1b\[\d*(;\d*)*m/g;
      return str.replace(sgrPattern, "");
    }
    exports.Help = Help2;
    exports.stripColor = stripColor;
  }
});

// node_modules/commander/lib/option.js
var require_option = __commonJS({
  "node_modules/commander/lib/option.js"(exports) {
    var { InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var Option2 = class {
      /**
       * Initialize a new `Option` with the given `flags` and `description`.
       *
       * @param {string} flags
       * @param {string} [description]
       */
      constructor(flags, description) {
        this.flags = flags;
        this.description = description || "";
        this.required = flags.includes("<");
        this.optional = flags.includes("[");
        this.variadic = /\w\.\.\.[>\]]$/.test(flags);
        this.mandatory = false;
        const optionFlags = splitOptionFlags(flags);
        this.short = optionFlags.shortFlag;
        this.long = optionFlags.longFlag;
        this.negate = false;
        if (this.long) {
          this.negate = this.long.startsWith("--no-");
        }
        this.defaultValue = void 0;
        this.defaultValueDescription = void 0;
        this.presetArg = void 0;
        this.envVar = void 0;
        this.parseArg = void 0;
        this.hidden = false;
        this.argChoices = void 0;
        this.conflictsWith = [];
        this.implied = void 0;
        this.helpGroupHeading = void 0;
      }
      /**
       * Set the default value, and optionally supply the description to be displayed in the help.
       *
       * @param {*} value
       * @param {string} [description]
       * @return {Option}
       */
      default(value, description) {
        this.defaultValue = value;
        this.defaultValueDescription = description;
        return this;
      }
      /**
       * Preset to use when option used without option-argument, especially optional but also boolean and negated.
       * The custom processing (parseArg) is called.
       *
       * @example
       * new Option('--color').default('GREYSCALE').preset('RGB');
       * new Option('--donate [amount]').preset('20').argParser(parseFloat);
       *
       * @param {*} arg
       * @return {Option}
       */
      preset(arg) {
        this.presetArg = arg;
        return this;
      }
      /**
       * Add option name(s) that conflict with this option.
       * An error will be displayed if conflicting options are found during parsing.
       *
       * @example
       * new Option('--rgb').conflicts('cmyk');
       * new Option('--js').conflicts(['ts', 'jsx']);
       *
       * @param {(string | string[])} names
       * @return {Option}
       */
      conflicts(names) {
        this.conflictsWith = this.conflictsWith.concat(names);
        return this;
      }
      /**
       * Specify implied option values for when this option is set and the implied options are not.
       *
       * The custom processing (parseArg) is not called on the implied values.
       *
       * @example
       * program
       *   .addOption(new Option('--log', 'write logging information to file'))
       *   .addOption(new Option('--trace', 'log extra details').implies({ log: 'trace.txt' }));
       *
       * @param {object} impliedOptionValues
       * @return {Option}
       */
      implies(impliedOptionValues) {
        let newImplied = impliedOptionValues;
        if (typeof impliedOptionValues === "string") {
          newImplied = { [impliedOptionValues]: true };
        }
        this.implied = Object.assign(this.implied || {}, newImplied);
        return this;
      }
      /**
       * Set environment variable to check for option value.
       *
       * An environment variable is only used if when processed the current option value is
       * undefined, or the source of the current value is 'default' or 'config' or 'env'.
       *
       * @param {string} name
       * @return {Option}
       */
      env(name) {
        this.envVar = name;
        return this;
      }
      /**
       * Set the custom handler for processing CLI option arguments into option values.
       *
       * @param {Function} [fn]
       * @return {Option}
       */
      argParser(fn) {
        this.parseArg = fn;
        return this;
      }
      /**
       * Whether the option is mandatory and must have a value after parsing.
       *
       * @param {boolean} [mandatory=true]
       * @return {Option}
       */
      makeOptionMandatory(mandatory = true) {
        this.mandatory = !!mandatory;
        return this;
      }
      /**
       * Hide option in help.
       *
       * @param {boolean} [hide=true]
       * @return {Option}
       */
      hideHelp(hide = true) {
        this.hidden = !!hide;
        return this;
      }
      /**
       * @package
       */
      _collectValue(value, previous) {
        if (previous === this.defaultValue || !Array.isArray(previous)) {
          return [value];
        }
        previous.push(value);
        return previous;
      }
      /**
       * Only allow option value to be one of choices.
       *
       * @param {string[]} values
       * @return {Option}
       */
      choices(values) {
        this.argChoices = values.slice();
        this.parseArg = (arg, previous) => {
          if (!this.argChoices.includes(arg)) {
            throw new InvalidArgumentError2(
              `Allowed choices are ${this.argChoices.join(", ")}.`
            );
          }
          if (this.variadic) {
            return this._collectValue(arg, previous);
          }
          return arg;
        };
        return this;
      }
      /**
       * Return option name.
       *
       * @return {string}
       */
      name() {
        if (this.long) {
          return this.long.replace(/^--/, "");
        }
        return this.short.replace(/^-/, "");
      }
      /**
       * Return option name, in a camelcase format that can be used
       * as an object attribute key.
       *
       * @return {string}
       */
      attributeName() {
        if (this.negate) {
          return camelcase(this.name().replace(/^no-/, ""));
        }
        return camelcase(this.name());
      }
      /**
       * Set the help group heading.
       *
       * @param {string} heading
       * @return {Option}
       */
      helpGroup(heading) {
        this.helpGroupHeading = heading;
        return this;
      }
      /**
       * Check if `arg` matches the short or long flag.
       *
       * @param {string} arg
       * @return {boolean}
       * @package
       */
      is(arg) {
        return this.short === arg || this.long === arg;
      }
      /**
       * Return whether a boolean option.
       *
       * Options are one of boolean, negated, required argument, or optional argument.
       *
       * @return {boolean}
       * @package
       */
      isBoolean() {
        return !this.required && !this.optional && !this.negate;
      }
    };
    var DualOptions = class {
      /**
       * @param {Option[]} options
       */
      constructor(options) {
        this.positiveOptions = /* @__PURE__ */ new Map();
        this.negativeOptions = /* @__PURE__ */ new Map();
        this.dualOptions = /* @__PURE__ */ new Set();
        options.forEach((option) => {
          if (option.negate) {
            this.negativeOptions.set(option.attributeName(), option);
          } else {
            this.positiveOptions.set(option.attributeName(), option);
          }
        });
        this.negativeOptions.forEach((value, key) => {
          if (this.positiveOptions.has(key)) {
            this.dualOptions.add(key);
          }
        });
      }
      /**
       * Did the value come from the option, and not from possible matching dual option?
       *
       * @param {*} value
       * @param {Option} option
       * @returns {boolean}
       */
      valueFromOption(value, option) {
        const optionKey = option.attributeName();
        if (!this.dualOptions.has(optionKey)) return true;
        const preset = this.negativeOptions.get(optionKey).presetArg;
        const negativeValue = preset !== void 0 ? preset : false;
        return option.negate === (negativeValue === value);
      }
    };
    function camelcase(str) {
      return str.split("-").reduce((str2, word) => {
        return str2 + word[0].toUpperCase() + word.slice(1);
      });
    }
    function splitOptionFlags(flags) {
      let shortFlag;
      let longFlag;
      const shortFlagExp = /^-[^-]$/;
      const longFlagExp = /^--[^-]/;
      const flagParts = flags.split(/[ |,]+/).concat("guard");
      if (shortFlagExp.test(flagParts[0])) shortFlag = flagParts.shift();
      if (longFlagExp.test(flagParts[0])) longFlag = flagParts.shift();
      if (!shortFlag && shortFlagExp.test(flagParts[0]))
        shortFlag = flagParts.shift();
      if (!shortFlag && longFlagExp.test(flagParts[0])) {
        shortFlag = longFlag;
        longFlag = flagParts.shift();
      }
      if (flagParts[0].startsWith("-")) {
        const unsupportedFlag = flagParts[0];
        const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
        if (/^-[^-][^-]/.test(unsupportedFlag))
          throw new Error(
            `${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`
          );
        if (shortFlagExp.test(unsupportedFlag))
          throw new Error(`${baseError}
- too many short flags`);
        if (longFlagExp.test(unsupportedFlag))
          throw new Error(`${baseError}
- too many long flags`);
        throw new Error(`${baseError}
- unrecognised flag format`);
      }
      if (shortFlag === void 0 && longFlag === void 0)
        throw new Error(
          `option creation failed due to no flags found in '${flags}'.`
        );
      return { shortFlag, longFlag };
    }
    exports.Option = Option2;
    exports.DualOptions = DualOptions;
  }
});

// node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS({
  "node_modules/commander/lib/suggestSimilar.js"(exports) {
    var maxDistance = 3;
    function editDistance(a, b) {
      if (Math.abs(a.length - b.length) > maxDistance)
        return Math.max(a.length, b.length);
      const d = [];
      for (let i = 0; i <= a.length; i++) {
        d[i] = [i];
      }
      for (let j = 0; j <= b.length; j++) {
        d[0][j] = j;
      }
      for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
          let cost = 1;
          if (a[i - 1] === b[j - 1]) {
            cost = 0;
          } else {
            cost = 1;
          }
          d[i][j] = Math.min(
            d[i - 1][j] + 1,
            // deletion
            d[i][j - 1] + 1,
            // insertion
            d[i - 1][j - 1] + cost
            // substitution
          );
          if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
            d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
          }
        }
      }
      return d[a.length][b.length];
    }
    function suggestSimilar(word, candidates) {
      if (!candidates || candidates.length === 0) return "";
      candidates = Array.from(new Set(candidates));
      const searchingOptions = word.startsWith("--");
      if (searchingOptions) {
        word = word.slice(2);
        candidates = candidates.map((candidate) => candidate.slice(2));
      }
      let similar = [];
      let bestDistance = maxDistance;
      const minSimilarity = 0.4;
      candidates.forEach((candidate) => {
        if (candidate.length <= 1) return;
        const distance = editDistance(word, candidate);
        const length = Math.max(word.length, candidate.length);
        const similarity = (length - distance) / length;
        if (similarity > minSimilarity) {
          if (distance < bestDistance) {
            bestDistance = distance;
            similar = [candidate];
          } else if (distance === bestDistance) {
            similar.push(candidate);
          }
        }
      });
      similar.sort((a, b) => a.localeCompare(b));
      if (searchingOptions) {
        similar = similar.map((candidate) => `--${candidate}`);
      }
      if (similar.length > 1) {
        return `
(Did you mean one of ${similar.join(", ")}?)`;
      }
      if (similar.length === 1) {
        return `
(Did you mean ${similar[0]}?)`;
      }
      return "";
    }
    exports.suggestSimilar = suggestSimilar;
  }
});

// node_modules/commander/lib/command.js
var require_command = __commonJS({
  "node_modules/commander/lib/command.js"(exports) {
    var EventEmitter = __require("node:events").EventEmitter;
    var childProcess = __require("node:child_process");
    var path = __require("node:path");
    var fs = __require("node:fs");
    var process2 = __require("node:process");
    var { Argument: Argument2, humanReadableArgName } = require_argument();
    var { CommanderError: CommanderError2 } = require_error();
    var { Help: Help2, stripColor } = require_help();
    var { Option: Option2, DualOptions } = require_option();
    var { suggestSimilar } = require_suggestSimilar();
    var Command2 = class _Command extends EventEmitter {
      /**
       * Initialize a new `Command`.
       *
       * @param {string} [name]
       */
      constructor(name) {
        super();
        this.commands = [];
        this.options = [];
        this.parent = null;
        this._allowUnknownOption = false;
        this._allowExcessArguments = false;
        this.registeredArguments = [];
        this._args = this.registeredArguments;
        this.args = [];
        this.rawArgs = [];
        this.processedArgs = [];
        this._scriptPath = null;
        this._name = name || "";
        this._optionValues = {};
        this._optionValueSources = {};
        this._storeOptionsAsProperties = false;
        this._actionHandler = null;
        this._executableHandler = false;
        this._executableFile = null;
        this._executableDir = null;
        this._defaultCommandName = null;
        this._exitCallback = null;
        this._aliases = [];
        this._combineFlagAndOptionalValue = true;
        this._description = "";
        this._summary = "";
        this._argsDescription = void 0;
        this._enablePositionalOptions = false;
        this._passThroughOptions = false;
        this._lifeCycleHooks = {};
        this._showHelpAfterError = false;
        this._showSuggestionAfterError = true;
        this._savedState = null;
        this._outputConfiguration = {
          writeOut: (str) => process2.stdout.write(str),
          writeErr: (str) => process2.stderr.write(str),
          outputError: (str, write) => write(str),
          getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : void 0,
          getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : void 0,
          getOutHasColors: () => useColor() ?? (process2.stdout.isTTY && process2.stdout.hasColors?.()),
          getErrHasColors: () => useColor() ?? (process2.stderr.isTTY && process2.stderr.hasColors?.()),
          stripColor: (str) => stripColor(str)
        };
        this._hidden = false;
        this._helpOption = void 0;
        this._addImplicitHelpCommand = void 0;
        this._helpCommand = void 0;
        this._helpConfiguration = {};
        this._helpGroupHeading = void 0;
        this._defaultCommandGroup = void 0;
        this._defaultOptionGroup = void 0;
      }
      /**
       * Copy settings that are useful to have in common across root command and subcommands.
       *
       * (Used internally when adding a command using `.command()` so subcommands inherit parent settings.)
       *
       * @param {Command} sourceCommand
       * @return {Command} `this` command for chaining
       */
      copyInheritedSettings(sourceCommand) {
        this._outputConfiguration = sourceCommand._outputConfiguration;
        this._helpOption = sourceCommand._helpOption;
        this._helpCommand = sourceCommand._helpCommand;
        this._helpConfiguration = sourceCommand._helpConfiguration;
        this._exitCallback = sourceCommand._exitCallback;
        this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
        this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
        this._allowExcessArguments = sourceCommand._allowExcessArguments;
        this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
        this._showHelpAfterError = sourceCommand._showHelpAfterError;
        this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
        return this;
      }
      /**
       * @returns {Command[]}
       * @private
       */
      _getCommandAndAncestors() {
        const result = [];
        for (let command = this; command; command = command.parent) {
          result.push(command);
        }
        return result;
      }
      /**
       * Define a command.
       *
       * There are two styles of command: pay attention to where to put the description.
       *
       * @example
       * // Command implemented using action handler (description is supplied separately to `.command`)
       * program
       *   .command('clone <source> [destination]')
       *   .description('clone a repository into a newly created directory')
       *   .action((source, destination) => {
       *     console.log('clone command called');
       *   });
       *
       * // Command implemented using separate executable file (description is second parameter to `.command`)
       * program
       *   .command('start <service>', 'start named service')
       *   .command('stop [service]', 'stop named service, or all if no name supplied');
       *
       * @param {string} nameAndArgs - command name and arguments, args are `<required>` or `[optional]` and last may also be `variadic...`
       * @param {(object | string)} [actionOptsOrExecDesc] - configuration options (for action), or description (for executable)
       * @param {object} [execOpts] - configuration options (for executable)
       * @return {Command} returns new command for action handler, or `this` for executable command
       */
      command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
        let desc = actionOptsOrExecDesc;
        let opts = execOpts;
        if (typeof desc === "object" && desc !== null) {
          opts = desc;
          desc = null;
        }
        opts = opts || {};
        const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
        const cmd = this.createCommand(name);
        if (desc) {
          cmd.description(desc);
          cmd._executableHandler = true;
        }
        if (opts.isDefault) this._defaultCommandName = cmd._name;
        cmd._hidden = !!(opts.noHelp || opts.hidden);
        cmd._executableFile = opts.executableFile || null;
        if (args) cmd.arguments(args);
        this._registerCommand(cmd);
        cmd.parent = this;
        cmd.copyInheritedSettings(this);
        if (desc) return this;
        return cmd;
      }
      /**
       * Factory routine to create a new unattached command.
       *
       * See .command() for creating an attached subcommand, which uses this routine to
       * create the command. You can override createCommand to customise subcommands.
       *
       * @param {string} [name]
       * @return {Command} new command
       */
      createCommand(name) {
        return new _Command(name);
      }
      /**
       * You can customise the help with a subclass of Help by overriding createHelp,
       * or by overriding Help properties using configureHelp().
       *
       * @return {Help}
       */
      createHelp() {
        return Object.assign(new Help2(), this.configureHelp());
      }
      /**
       * You can customise the help by overriding Help properties using configureHelp(),
       * or with a subclass of Help by overriding createHelp().
       *
       * @param {object} [configuration] - configuration options
       * @return {(Command | object)} `this` command for chaining, or stored configuration
       */
      configureHelp(configuration) {
        if (configuration === void 0) return this._helpConfiguration;
        this._helpConfiguration = configuration;
        return this;
      }
      /**
       * The default output goes to stdout and stderr. You can customise this for special
       * applications. You can also customise the display of errors by overriding outputError.
       *
       * The configuration properties are all functions:
       *
       *     // change how output being written, defaults to stdout and stderr
       *     writeOut(str)
       *     writeErr(str)
       *     // change how output being written for errors, defaults to writeErr
       *     outputError(str, write) // used for displaying errors and not used for displaying help
       *     // specify width for wrapping help
       *     getOutHelpWidth()
       *     getErrHelpWidth()
       *     // color support, currently only used with Help
       *     getOutHasColors()
       *     getErrHasColors()
       *     stripColor() // used to remove ANSI escape codes if output does not have colors
       *
       * @param {object} [configuration] - configuration options
       * @return {(Command | object)} `this` command for chaining, or stored configuration
       */
      configureOutput(configuration) {
        if (configuration === void 0) return this._outputConfiguration;
        this._outputConfiguration = {
          ...this._outputConfiguration,
          ...configuration
        };
        return this;
      }
      /**
       * Display the help or a custom message after an error occurs.
       *
       * @param {(boolean|string)} [displayHelp]
       * @return {Command} `this` command for chaining
       */
      showHelpAfterError(displayHelp = true) {
        if (typeof displayHelp !== "string") displayHelp = !!displayHelp;
        this._showHelpAfterError = displayHelp;
        return this;
      }
      /**
       * Display suggestion of similar commands for unknown commands, or options for unknown options.
       *
       * @param {boolean} [displaySuggestion]
       * @return {Command} `this` command for chaining
       */
      showSuggestionAfterError(displaySuggestion = true) {
        this._showSuggestionAfterError = !!displaySuggestion;
        return this;
      }
      /**
       * Add a prepared subcommand.
       *
       * See .command() for creating an attached subcommand which inherits settings from its parent.
       *
       * @param {Command} cmd - new subcommand
       * @param {object} [opts] - configuration options
       * @return {Command} `this` command for chaining
       */
      addCommand(cmd, opts) {
        if (!cmd._name) {
          throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
        }
        opts = opts || {};
        if (opts.isDefault) this._defaultCommandName = cmd._name;
        if (opts.noHelp || opts.hidden) cmd._hidden = true;
        this._registerCommand(cmd);
        cmd.parent = this;
        cmd._checkForBrokenPassThrough();
        return this;
      }
      /**
       * Factory routine to create a new unattached argument.
       *
       * See .argument() for creating an attached argument, which uses this routine to
       * create the argument. You can override createArgument to return a custom argument.
       *
       * @param {string} name
       * @param {string} [description]
       * @return {Argument} new argument
       */
      createArgument(name, description) {
        return new Argument2(name, description);
      }
      /**
       * Define argument syntax for command.
       *
       * The default is that the argument is required, and you can explicitly
       * indicate this with <> around the name. Put [] around the name for an optional argument.
       *
       * @example
       * program.argument('<input-file>');
       * program.argument('[output-file]');
       *
       * @param {string} name
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom argument processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      argument(name, description, parseArg, defaultValue) {
        const argument = this.createArgument(name, description);
        if (typeof parseArg === "function") {
          argument.default(defaultValue).argParser(parseArg);
        } else {
          argument.default(parseArg);
        }
        this.addArgument(argument);
        return this;
      }
      /**
       * Define argument syntax for command, adding multiple at once (without descriptions).
       *
       * See also .argument().
       *
       * @example
       * program.arguments('<cmd> [env]');
       *
       * @param {string} names
       * @return {Command} `this` command for chaining
       */
      arguments(names) {
        names.trim().split(/ +/).forEach((detail) => {
          this.argument(detail);
        });
        return this;
      }
      /**
       * Define argument syntax for command, adding a prepared argument.
       *
       * @param {Argument} argument
       * @return {Command} `this` command for chaining
       */
      addArgument(argument) {
        const previousArgument = this.registeredArguments.slice(-1)[0];
        if (previousArgument?.variadic) {
          throw new Error(
            `only the last argument can be variadic '${previousArgument.name()}'`
          );
        }
        if (argument.required && argument.defaultValue !== void 0 && argument.parseArg === void 0) {
          throw new Error(
            `a default value for a required argument is never used: '${argument.name()}'`
          );
        }
        this.registeredArguments.push(argument);
        return this;
      }
      /**
       * Customise or override default help command. By default a help command is automatically added if your command has subcommands.
       *
       * @example
       *    program.helpCommand('help [cmd]');
       *    program.helpCommand('help [cmd]', 'show help');
       *    program.helpCommand(false); // suppress default help command
       *    program.helpCommand(true); // add help command even if no subcommands
       *
       * @param {string|boolean} enableOrNameAndArgs - enable with custom name and/or arguments, or boolean to override whether added
       * @param {string} [description] - custom description
       * @return {Command} `this` command for chaining
       */
      helpCommand(enableOrNameAndArgs, description) {
        if (typeof enableOrNameAndArgs === "boolean") {
          this._addImplicitHelpCommand = enableOrNameAndArgs;
          if (enableOrNameAndArgs && this._defaultCommandGroup) {
            this._initCommandGroup(this._getHelpCommand());
          }
          return this;
        }
        const nameAndArgs = enableOrNameAndArgs ?? "help [command]";
        const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
        const helpDescription = description ?? "display help for command";
        const helpCommand = this.createCommand(helpName);
        helpCommand.helpOption(false);
        if (helpArgs) helpCommand.arguments(helpArgs);
        if (helpDescription) helpCommand.description(helpDescription);
        this._addImplicitHelpCommand = true;
        this._helpCommand = helpCommand;
        if (enableOrNameAndArgs || description) this._initCommandGroup(helpCommand);
        return this;
      }
      /**
       * Add prepared custom help command.
       *
       * @param {(Command|string|boolean)} helpCommand - custom help command, or deprecated enableOrNameAndArgs as for `.helpCommand()`
       * @param {string} [deprecatedDescription] - deprecated custom description used with custom name only
       * @return {Command} `this` command for chaining
       */
      addHelpCommand(helpCommand, deprecatedDescription) {
        if (typeof helpCommand !== "object") {
          this.helpCommand(helpCommand, deprecatedDescription);
          return this;
        }
        this._addImplicitHelpCommand = true;
        this._helpCommand = helpCommand;
        this._initCommandGroup(helpCommand);
        return this;
      }
      /**
       * Lazy create help command.
       *
       * @return {(Command|null)}
       * @package
       */
      _getHelpCommand() {
        const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
        if (hasImplicitHelpCommand) {
          if (this._helpCommand === void 0) {
            this.helpCommand(void 0, void 0);
          }
          return this._helpCommand;
        }
        return null;
      }
      /**
       * Add hook for life cycle event.
       *
       * @param {string} event
       * @param {Function} listener
       * @return {Command} `this` command for chaining
       */
      hook(event, listener) {
        const allowedValues = ["preSubcommand", "preAction", "postAction"];
        if (!allowedValues.includes(event)) {
          throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
        }
        if (this._lifeCycleHooks[event]) {
          this._lifeCycleHooks[event].push(listener);
        } else {
          this._lifeCycleHooks[event] = [listener];
        }
        return this;
      }
      /**
       * Register callback to use as replacement for calling process.exit.
       *
       * @param {Function} [fn] optional callback which will be passed a CommanderError, defaults to throwing
       * @return {Command} `this` command for chaining
       */
      exitOverride(fn) {
        if (fn) {
          this._exitCallback = fn;
        } else {
          this._exitCallback = (err) => {
            if (err.code !== "commander.executeSubCommandAsync") {
              throw err;
            } else {
            }
          };
        }
        return this;
      }
      /**
       * Call process.exit, and _exitCallback if defined.
       *
       * @param {number} exitCode exit code for using with process.exit
       * @param {string} code an id string representing the error
       * @param {string} message human-readable description of the error
       * @return never
       * @private
       */
      _exit(exitCode, code, message) {
        if (this._exitCallback) {
          this._exitCallback(new CommanderError2(exitCode, code, message));
        }
        process2.exit(exitCode);
      }
      /**
       * Register callback `fn` for the command.
       *
       * @example
       * program
       *   .command('serve')
       *   .description('start service')
       *   .action(function() {
       *      // do work here
       *   });
       *
       * @param {Function} fn
       * @return {Command} `this` command for chaining
       */
      action(fn) {
        const listener = (args) => {
          const expectedArgsCount = this.registeredArguments.length;
          const actionArgs = args.slice(0, expectedArgsCount);
          if (this._storeOptionsAsProperties) {
            actionArgs[expectedArgsCount] = this;
          } else {
            actionArgs[expectedArgsCount] = this.opts();
          }
          actionArgs.push(this);
          return fn.apply(this, actionArgs);
        };
        this._actionHandler = listener;
        return this;
      }
      /**
       * Factory routine to create a new unattached option.
       *
       * See .option() for creating an attached option, which uses this routine to
       * create the option. You can override createOption to return a custom option.
       *
       * @param {string} flags
       * @param {string} [description]
       * @return {Option} new option
       */
      createOption(flags, description) {
        return new Option2(flags, description);
      }
      /**
       * Wrap parseArgs to catch 'commander.invalidArgument'.
       *
       * @param {(Option | Argument)} target
       * @param {string} value
       * @param {*} previous
       * @param {string} invalidArgumentMessage
       * @private
       */
      _callParseArg(target, value, previous, invalidArgumentMessage) {
        try {
          return target.parseArg(value, previous);
        } catch (err) {
          if (err.code === "commander.invalidArgument") {
            const message = `${invalidArgumentMessage} ${err.message}`;
            this.error(message, { exitCode: err.exitCode, code: err.code });
          }
          throw err;
        }
      }
      /**
       * Check for option flag conflicts.
       * Register option if no conflicts found, or throw on conflict.
       *
       * @param {Option} option
       * @private
       */
      _registerOption(option) {
        const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
        if (matchingOption) {
          const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
          throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
        }
        this._initOptionGroup(option);
        this.options.push(option);
      }
      /**
       * Check for command name and alias conflicts with existing commands.
       * Register command if no conflicts found, or throw on conflict.
       *
       * @param {Command} command
       * @private
       */
      _registerCommand(command) {
        const knownBy = (cmd) => {
          return [cmd.name()].concat(cmd.aliases());
        };
        const alreadyUsed = knownBy(command).find(
          (name) => this._findCommand(name)
        );
        if (alreadyUsed) {
          const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
          const newCmd = knownBy(command).join("|");
          throw new Error(
            `cannot add command '${newCmd}' as already have command '${existingCmd}'`
          );
        }
        this._initCommandGroup(command);
        this.commands.push(command);
      }
      /**
       * Add an option.
       *
       * @param {Option} option
       * @return {Command} `this` command for chaining
       */
      addOption(option) {
        this._registerOption(option);
        const oname = option.name();
        const name = option.attributeName();
        if (option.negate) {
          const positiveLongFlag = option.long.replace(/^--no-/, "--");
          if (!this._findOption(positiveLongFlag)) {
            this.setOptionValueWithSource(
              name,
              option.defaultValue === void 0 ? true : option.defaultValue,
              "default"
            );
          }
        } else if (option.defaultValue !== void 0) {
          this.setOptionValueWithSource(name, option.defaultValue, "default");
        }
        const handleOptionValue = (val, invalidValueMessage, valueSource) => {
          if (val == null && option.presetArg !== void 0) {
            val = option.presetArg;
          }
          const oldValue = this.getOptionValue(name);
          if (val !== null && option.parseArg) {
            val = this._callParseArg(option, val, oldValue, invalidValueMessage);
          } else if (val !== null && option.variadic) {
            val = option._collectValue(val, oldValue);
          }
          if (val == null) {
            if (option.negate) {
              val = false;
            } else if (option.isBoolean() || option.optional) {
              val = true;
            } else {
              val = "";
            }
          }
          this.setOptionValueWithSource(name, val, valueSource);
        };
        this.on("option:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "cli");
        });
        if (option.envVar) {
          this.on("optionEnv:" + oname, (val) => {
            const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
            handleOptionValue(val, invalidValueMessage, "env");
          });
        }
        return this;
      }
      /**
       * Internal implementation shared by .option() and .requiredOption()
       *
       * @return {Command} `this` command for chaining
       * @private
       */
      _optionEx(config, flags, description, fn, defaultValue) {
        if (typeof flags === "object" && flags instanceof Option2) {
          throw new Error(
            "To add an Option object use addOption() instead of option() or requiredOption()"
          );
        }
        const option = this.createOption(flags, description);
        option.makeOptionMandatory(!!config.mandatory);
        if (typeof fn === "function") {
          option.default(defaultValue).argParser(fn);
        } else if (fn instanceof RegExp) {
          const regex = fn;
          fn = (val, def) => {
            const m = regex.exec(val);
            return m ? m[0] : def;
          };
          option.default(defaultValue).argParser(fn);
        } else {
          option.default(fn);
        }
        return this.addOption(option);
      }
      /**
       * Define option with `flags`, `description`, and optional argument parsing function or `defaultValue` or both.
       *
       * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space. A required
       * option-argument is indicated by `<>` and an optional option-argument by `[]`.
       *
       * See the README for more details, and see also addOption() and requiredOption().
       *
       * @example
       * program
       *     .option('-p, --pepper', 'add pepper')
       *     .option('--pt, --pizza-type <TYPE>', 'type of pizza') // required option-argument
       *     .option('-c, --cheese [CHEESE]', 'add extra cheese', 'mozzarella') // optional option-argument with default
       *     .option('-t, --tip <VALUE>', 'add tip to purchase cost', parseFloat) // custom parse function
       *
       * @param {string} flags
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom option processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      option(flags, description, parseArg, defaultValue) {
        return this._optionEx({}, flags, description, parseArg, defaultValue);
      }
      /**
       * Add a required option which must have a value after parsing. This usually means
       * the option must be specified on the command line. (Otherwise the same as .option().)
       *
       * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space.
       *
       * @param {string} flags
       * @param {string} [description]
       * @param {(Function|*)} [parseArg] - custom option processing function or default value
       * @param {*} [defaultValue]
       * @return {Command} `this` command for chaining
       */
      requiredOption(flags, description, parseArg, defaultValue) {
        return this._optionEx(
          { mandatory: true },
          flags,
          description,
          parseArg,
          defaultValue
        );
      }
      /**
       * Alter parsing of short flags with optional values.
       *
       * @example
       * // for `.option('-f,--flag [value]'):
       * program.combineFlagAndOptionalValue(true);  // `-f80` is treated like `--flag=80`, this is the default behaviour
       * program.combineFlagAndOptionalValue(false) // `-fb` is treated like `-f -b`
       *
       * @param {boolean} [combine] - if `true` or omitted, an optional value can be specified directly after the flag.
       * @return {Command} `this` command for chaining
       */
      combineFlagAndOptionalValue(combine = true) {
        this._combineFlagAndOptionalValue = !!combine;
        return this;
      }
      /**
       * Allow unknown options on the command line.
       *
       * @param {boolean} [allowUnknown] - if `true` or omitted, no error will be thrown for unknown options.
       * @return {Command} `this` command for chaining
       */
      allowUnknownOption(allowUnknown = true) {
        this._allowUnknownOption = !!allowUnknown;
        return this;
      }
      /**
       * Allow excess command-arguments on the command line. Pass false to make excess arguments an error.
       *
       * @param {boolean} [allowExcess] - if `true` or omitted, no error will be thrown for excess arguments.
       * @return {Command} `this` command for chaining
       */
      allowExcessArguments(allowExcess = true) {
        this._allowExcessArguments = !!allowExcess;
        return this;
      }
      /**
       * Enable positional options. Positional means global options are specified before subcommands which lets
       * subcommands reuse the same option names, and also enables subcommands to turn on passThroughOptions.
       * The default behaviour is non-positional and global options may appear anywhere on the command line.
       *
       * @param {boolean} [positional]
       * @return {Command} `this` command for chaining
       */
      enablePositionalOptions(positional = true) {
        this._enablePositionalOptions = !!positional;
        return this;
      }
      /**
       * Pass through options that come after command-arguments rather than treat them as command-options,
       * so actual command-options come before command-arguments. Turning this on for a subcommand requires
       * positional options to have been enabled on the program (parent commands).
       * The default behaviour is non-positional and options may appear before or after command-arguments.
       *
       * @param {boolean} [passThrough] for unknown options.
       * @return {Command} `this` command for chaining
       */
      passThroughOptions(passThrough = true) {
        this._passThroughOptions = !!passThrough;
        this._checkForBrokenPassThrough();
        return this;
      }
      /**
       * @private
       */
      _checkForBrokenPassThrough() {
        if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
          throw new Error(
            `passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`
          );
        }
      }
      /**
       * Whether to store option values as properties on command object,
       * or store separately (specify false). In both cases the option values can be accessed using .opts().
       *
       * @param {boolean} [storeAsProperties=true]
       * @return {Command} `this` command for chaining
       */
      storeOptionsAsProperties(storeAsProperties = true) {
        if (this.options.length) {
          throw new Error("call .storeOptionsAsProperties() before adding options");
        }
        if (Object.keys(this._optionValues).length) {
          throw new Error(
            "call .storeOptionsAsProperties() before setting option values"
          );
        }
        this._storeOptionsAsProperties = !!storeAsProperties;
        return this;
      }
      /**
       * Retrieve option value.
       *
       * @param {string} key
       * @return {object} value
       */
      getOptionValue(key) {
        if (this._storeOptionsAsProperties) {
          return this[key];
        }
        return this._optionValues[key];
      }
      /**
       * Store option value.
       *
       * @param {string} key
       * @param {object} value
       * @return {Command} `this` command for chaining
       */
      setOptionValue(key, value) {
        return this.setOptionValueWithSource(key, value, void 0);
      }
      /**
       * Store option value and where the value came from.
       *
       * @param {string} key
       * @param {object} value
       * @param {string} source - expected values are default/config/env/cli/implied
       * @return {Command} `this` command for chaining
       */
      setOptionValueWithSource(key, value, source) {
        if (this._storeOptionsAsProperties) {
          this[key] = value;
        } else {
          this._optionValues[key] = value;
        }
        this._optionValueSources[key] = source;
        return this;
      }
      /**
       * Get source of option value.
       * Expected values are default | config | env | cli | implied
       *
       * @param {string} key
       * @return {string}
       */
      getOptionValueSource(key) {
        return this._optionValueSources[key];
      }
      /**
       * Get source of option value. See also .optsWithGlobals().
       * Expected values are default | config | env | cli | implied
       *
       * @param {string} key
       * @return {string}
       */
      getOptionValueSourceWithGlobals(key) {
        let source;
        this._getCommandAndAncestors().forEach((cmd) => {
          if (cmd.getOptionValueSource(key) !== void 0) {
            source = cmd.getOptionValueSource(key);
          }
        });
        return source;
      }
      /**
       * Get user arguments from implied or explicit arguments.
       * Side-effects: set _scriptPath if args included script. Used for default program name, and subcommand searches.
       *
       * @private
       */
      _prepareUserArgs(argv, parseOptions) {
        if (argv !== void 0 && !Array.isArray(argv)) {
          throw new Error("first parameter to parse must be array or undefined");
        }
        parseOptions = parseOptions || {};
        if (argv === void 0 && parseOptions.from === void 0) {
          if (process2.versions?.electron) {
            parseOptions.from = "electron";
          }
          const execArgv = process2.execArgv ?? [];
          if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
            parseOptions.from = "eval";
          }
        }
        if (argv === void 0) {
          argv = process2.argv;
        }
        this.rawArgs = argv.slice();
        let userArgs;
        switch (parseOptions.from) {
          case void 0:
          case "node":
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
            break;
          case "electron":
            if (process2.defaultApp) {
              this._scriptPath = argv[1];
              userArgs = argv.slice(2);
            } else {
              userArgs = argv.slice(1);
            }
            break;
          case "user":
            userArgs = argv.slice(0);
            break;
          case "eval":
            userArgs = argv.slice(1);
            break;
          default:
            throw new Error(
              `unexpected parse option { from: '${parseOptions.from}' }`
            );
        }
        if (!this._name && this._scriptPath)
          this.nameFromFilename(this._scriptPath);
        this._name = this._name || "program";
        return userArgs;
      }
      /**
       * Parse `argv`, setting options and invoking commands when defined.
       *
       * Use parseAsync instead of parse if any of your action handlers are async.
       *
       * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
       *
       * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
       * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
       * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
       * - `'user'`: just user arguments
       *
       * @example
       * program.parse(); // parse process.argv and auto-detect electron and special node flags
       * program.parse(process.argv); // assume argv[0] is app and argv[1] is script
       * program.parse(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
       *
       * @param {string[]} [argv] - optional, defaults to process.argv
       * @param {object} [parseOptions] - optionally specify style of options with from: node/user/electron
       * @param {string} [parseOptions.from] - where the args are from: 'node', 'user', 'electron'
       * @return {Command} `this` command for chaining
       */
      parse(argv, parseOptions) {
        this._prepareForParse();
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        this._parseCommand([], userArgs);
        return this;
      }
      /**
       * Parse `argv`, setting options and invoking commands when defined.
       *
       * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
       *
       * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
       * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
       * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
       * - `'user'`: just user arguments
       *
       * @example
       * await program.parseAsync(); // parse process.argv and auto-detect electron and special node flags
       * await program.parseAsync(process.argv); // assume argv[0] is app and argv[1] is script
       * await program.parseAsync(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
       *
       * @param {string[]} [argv]
       * @param {object} [parseOptions]
       * @param {string} parseOptions.from - where the args are from: 'node', 'user', 'electron'
       * @return {Promise}
       */
      async parseAsync(argv, parseOptions) {
        this._prepareForParse();
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        await this._parseCommand([], userArgs);
        return this;
      }
      _prepareForParse() {
        if (this._savedState === null) {
          this.saveStateBeforeParse();
        } else {
          this.restoreStateBeforeParse();
        }
      }
      /**
       * Called the first time parse is called to save state and allow a restore before subsequent calls to parse.
       * Not usually called directly, but available for subclasses to save their custom state.
       *
       * This is called in a lazy way. Only commands used in parsing chain will have state saved.
       */
      saveStateBeforeParse() {
        this._savedState = {
          // name is stable if supplied by author, but may be unspecified for root command and deduced during parsing
          _name: this._name,
          // option values before parse have default values (including false for negated options)
          // shallow clones
          _optionValues: { ...this._optionValues },
          _optionValueSources: { ...this._optionValueSources }
        };
      }
      /**
       * Restore state before parse for calls after the first.
       * Not usually called directly, but available for subclasses to save their custom state.
       *
       * This is called in a lazy way. Only commands used in parsing chain will have state restored.
       */
      restoreStateBeforeParse() {
        if (this._storeOptionsAsProperties)
          throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
        this._name = this._savedState._name;
        this._scriptPath = null;
        this.rawArgs = [];
        this._optionValues = { ...this._savedState._optionValues };
        this._optionValueSources = { ...this._savedState._optionValueSources };
        this.args = [];
        this.processedArgs = [];
      }
      /**
       * Throw if expected executable is missing. Add lots of help for author.
       *
       * @param {string} executableFile
       * @param {string} executableDir
       * @param {string} subcommandName
       */
      _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
        if (fs.existsSync(executableFile)) return;
        const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
        const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
        throw new Error(executableMissing);
      }
      /**
       * Execute a sub-command executable.
       *
       * @private
       */
      _executeSubCommand(subcommand, args) {
        args = args.slice();
        let launchWithNode = false;
        const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
        function findFile(baseDir, baseName) {
          const localBin = path.resolve(baseDir, baseName);
          if (fs.existsSync(localBin)) return localBin;
          if (sourceExt.includes(path.extname(baseName))) return void 0;
          const foundExt = sourceExt.find(
            (ext) => fs.existsSync(`${localBin}${ext}`)
          );
          if (foundExt) return `${localBin}${foundExt}`;
          return void 0;
        }
        this._checkForMissingMandatoryOptions();
        this._checkForConflictingOptions();
        let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
        let executableDir = this._executableDir || "";
        if (this._scriptPath) {
          let resolvedScriptPath;
          try {
            resolvedScriptPath = fs.realpathSync(this._scriptPath);
          } catch {
            resolvedScriptPath = this._scriptPath;
          }
          executableDir = path.resolve(
            path.dirname(resolvedScriptPath),
            executableDir
          );
        }
        if (executableDir) {
          let localFile = findFile(executableDir, executableFile);
          if (!localFile && !subcommand._executableFile && this._scriptPath) {
            const legacyName = path.basename(
              this._scriptPath,
              path.extname(this._scriptPath)
            );
            if (legacyName !== this._name) {
              localFile = findFile(
                executableDir,
                `${legacyName}-${subcommand._name}`
              );
            }
          }
          executableFile = localFile || executableFile;
        }
        launchWithNode = sourceExt.includes(path.extname(executableFile));
        let proc;
        if (process2.platform !== "win32") {
          if (launchWithNode) {
            args.unshift(executableFile);
            args = incrementNodeInspectorPort(process2.execArgv).concat(args);
            proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
          } else {
            proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
          }
        } else {
          this._checkForMissingExecutable(
            executableFile,
            executableDir,
            subcommand._name
          );
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process2.execArgv).concat(args);
          proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
        }
        if (!proc.killed) {
          const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
          signals.forEach((signal) => {
            process2.on(signal, () => {
              if (proc.killed === false && proc.exitCode === null) {
                proc.kill(signal);
              }
            });
          });
        }
        const exitCallback = this._exitCallback;
        proc.on("close", (code) => {
          code = code ?? 1;
          if (!exitCallback) {
            process2.exit(code);
          } else {
            exitCallback(
              new CommanderError2(
                code,
                "commander.executeSubCommandAsync",
                "(close)"
              )
            );
          }
        });
        proc.on("error", (err) => {
          if (err.code === "ENOENT") {
            this._checkForMissingExecutable(
              executableFile,
              executableDir,
              subcommand._name
            );
          } else if (err.code === "EACCES") {
            throw new Error(`'${executableFile}' not executable`);
          }
          if (!exitCallback) {
            process2.exit(1);
          } else {
            const wrappedError = new CommanderError2(
              1,
              "commander.executeSubCommandAsync",
              "(error)"
            );
            wrappedError.nestedError = err;
            exitCallback(wrappedError);
          }
        });
        this.runningCommand = proc;
      }
      /**
       * @private
       */
      _dispatchSubcommand(commandName, operands, unknown) {
        const subCommand = this._findCommand(commandName);
        if (!subCommand) this.help({ error: true });
        subCommand._prepareForParse();
        let promiseChain;
        promiseChain = this._chainOrCallSubCommandHook(
          promiseChain,
          subCommand,
          "preSubcommand"
        );
        promiseChain = this._chainOrCall(promiseChain, () => {
          if (subCommand._executableHandler) {
            this._executeSubCommand(subCommand, operands.concat(unknown));
          } else {
            return subCommand._parseCommand(operands, unknown);
          }
        });
        return promiseChain;
      }
      /**
       * Invoke help directly if possible, or dispatch if necessary.
       * e.g. help foo
       *
       * @private
       */
      _dispatchHelpCommand(subcommandName) {
        if (!subcommandName) {
          this.help();
        }
        const subCommand = this._findCommand(subcommandName);
        if (subCommand && !subCommand._executableHandler) {
          subCommand.help();
        }
        return this._dispatchSubcommand(
          subcommandName,
          [],
          [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]
        );
      }
      /**
       * Check this.args against expected this.registeredArguments.
       *
       * @private
       */
      _checkNumberOfArguments() {
        this.registeredArguments.forEach((arg, i) => {
          if (arg.required && this.args[i] == null) {
            this.missingArgument(arg.name());
          }
        });
        if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
          return;
        }
        if (this.args.length > this.registeredArguments.length) {
          this._excessArguments(this.args);
        }
      }
      /**
       * Process this.args using this.registeredArguments and save as this.processedArgs!
       *
       * @private
       */
      _processArguments() {
        const myParseArg = (argument, value, previous) => {
          let parsedValue = value;
          if (value !== null && argument.parseArg) {
            const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
            parsedValue = this._callParseArg(
              argument,
              value,
              previous,
              invalidValueMessage
            );
          }
          return parsedValue;
        };
        this._checkNumberOfArguments();
        const processedArgs = [];
        this.registeredArguments.forEach((declaredArg, index) => {
          let value = declaredArg.defaultValue;
          if (declaredArg.variadic) {
            if (index < this.args.length) {
              value = this.args.slice(index);
              if (declaredArg.parseArg) {
                value = value.reduce((processed, v) => {
                  return myParseArg(declaredArg, v, processed);
                }, declaredArg.defaultValue);
              }
            } else if (value === void 0) {
              value = [];
            }
          } else if (index < this.args.length) {
            value = this.args[index];
            if (declaredArg.parseArg) {
              value = myParseArg(declaredArg, value, declaredArg.defaultValue);
            }
          }
          processedArgs[index] = value;
        });
        this.processedArgs = processedArgs;
      }
      /**
       * Once we have a promise we chain, but call synchronously until then.
       *
       * @param {(Promise|undefined)} promise
       * @param {Function} fn
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCall(promise, fn) {
        if (promise?.then && typeof promise.then === "function") {
          return promise.then(() => fn());
        }
        return fn();
      }
      /**
       *
       * @param {(Promise|undefined)} promise
       * @param {string} event
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCallHooks(promise, event) {
        let result = promise;
        const hooks = [];
        this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== void 0).forEach((hookedCommand) => {
          hookedCommand._lifeCycleHooks[event].forEach((callback) => {
            hooks.push({ hookedCommand, callback });
          });
        });
        if (event === "postAction") {
          hooks.reverse();
        }
        hooks.forEach((hookDetail) => {
          result = this._chainOrCall(result, () => {
            return hookDetail.callback(hookDetail.hookedCommand, this);
          });
        });
        return result;
      }
      /**
       *
       * @param {(Promise|undefined)} promise
       * @param {Command} subCommand
       * @param {string} event
       * @return {(Promise|undefined)}
       * @private
       */
      _chainOrCallSubCommandHook(promise, subCommand, event) {
        let result = promise;
        if (this._lifeCycleHooks[event] !== void 0) {
          this._lifeCycleHooks[event].forEach((hook) => {
            result = this._chainOrCall(result, () => {
              return hook(this, subCommand);
            });
          });
        }
        return result;
      }
      /**
       * Process arguments in context of this command.
       * Returns action result, in case it is a promise.
       *
       * @private
       */
      _parseCommand(operands, unknown) {
        const parsed = this.parseOptions(unknown);
        this._parseOptionsEnv();
        this._parseOptionsImplied();
        operands = operands.concat(parsed.operands);
        unknown = parsed.unknown;
        this.args = operands.concat(unknown);
        if (operands && this._findCommand(operands[0])) {
          return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
        }
        if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
          return this._dispatchHelpCommand(operands[1]);
        }
        if (this._defaultCommandName) {
          this._outputHelpIfRequested(unknown);
          return this._dispatchSubcommand(
            this._defaultCommandName,
            operands,
            unknown
          );
        }
        if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
          this.help({ error: true });
        }
        this._outputHelpIfRequested(parsed.unknown);
        this._checkForMissingMandatoryOptions();
        this._checkForConflictingOptions();
        const checkForUnknownOptions = () => {
          if (parsed.unknown.length > 0) {
            this.unknownOption(parsed.unknown[0]);
          }
        };
        const commandEvent = `command:${this.name()}`;
        if (this._actionHandler) {
          checkForUnknownOptions();
          this._processArguments();
          let promiseChain;
          promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
          promiseChain = this._chainOrCall(
            promiseChain,
            () => this._actionHandler(this.processedArgs)
          );
          if (this.parent) {
            promiseChain = this._chainOrCall(promiseChain, () => {
              this.parent.emit(commandEvent, operands, unknown);
            });
          }
          promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
          return promiseChain;
        }
        if (this.parent?.listenerCount(commandEvent)) {
          checkForUnknownOptions();
          this._processArguments();
          this.parent.emit(commandEvent, operands, unknown);
        } else if (operands.length) {
          if (this._findCommand("*")) {
            return this._dispatchSubcommand("*", operands, unknown);
          }
          if (this.listenerCount("command:*")) {
            this.emit("command:*", operands, unknown);
          } else if (this.commands.length) {
            this.unknownCommand();
          } else {
            checkForUnknownOptions();
            this._processArguments();
          }
        } else if (this.commands.length) {
          checkForUnknownOptions();
          this.help({ error: true });
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      }
      /**
       * Find matching command.
       *
       * @private
       * @return {Command | undefined}
       */
      _findCommand(name) {
        if (!name) return void 0;
        return this.commands.find(
          (cmd) => cmd._name === name || cmd._aliases.includes(name)
        );
      }
      /**
       * Return an option matching `arg` if any.
       *
       * @param {string} arg
       * @return {Option}
       * @package
       */
      _findOption(arg) {
        return this.options.find((option) => option.is(arg));
      }
      /**
       * Display an error message if a mandatory option does not have a value.
       * Called after checking for help flags in leaf subcommand.
       *
       * @private
       */
      _checkForMissingMandatoryOptions() {
        this._getCommandAndAncestors().forEach((cmd) => {
          cmd.options.forEach((anOption) => {
            if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === void 0) {
              cmd.missingMandatoryOptionValue(anOption);
            }
          });
        });
      }
      /**
       * Display an error message if conflicting options are used together in this.
       *
       * @private
       */
      _checkForConflictingLocalOptions() {
        const definedNonDefaultOptions = this.options.filter((option) => {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === void 0) {
            return false;
          }
          return this.getOptionValueSource(optionKey) !== "default";
        });
        const optionsWithConflicting = definedNonDefaultOptions.filter(
          (option) => option.conflictsWith.length > 0
        );
        optionsWithConflicting.forEach((option) => {
          const conflictingAndDefined = definedNonDefaultOptions.find(
            (defined) => option.conflictsWith.includes(defined.attributeName())
          );
          if (conflictingAndDefined) {
            this._conflictingOption(option, conflictingAndDefined);
          }
        });
      }
      /**
       * Display an error message if conflicting options are used together.
       * Called after checking for help flags in leaf subcommand.
       *
       * @private
       */
      _checkForConflictingOptions() {
        this._getCommandAndAncestors().forEach((cmd) => {
          cmd._checkForConflictingLocalOptions();
        });
      }
      /**
       * Parse options from `argv` removing known options,
       * and return argv split into operands and unknown arguments.
       *
       * Side effects: modifies command by storing options. Does not reset state if called again.
       *
       * Examples:
       *
       *     argv => operands, unknown
       *     --known kkk op => [op], []
       *     op --known kkk => [op], []
       *     sub --unknown uuu op => [sub], [--unknown uuu op]
       *     sub -- --unknown uuu op => [sub --unknown uuu op], []
       *
       * @param {string[]} args
       * @return {{operands: string[], unknown: string[]}}
       */
      parseOptions(args) {
        const operands = [];
        const unknown = [];
        let dest = operands;
        function maybeOption(arg) {
          return arg.length > 1 && arg[0] === "-";
        }
        const negativeNumberArg = (arg) => {
          if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg)) return false;
          return !this._getCommandAndAncestors().some(
            (cmd) => cmd.options.map((opt) => opt.short).some((short) => /^-\d$/.test(short))
          );
        };
        let activeVariadicOption = null;
        let activeGroup = null;
        let i = 0;
        while (i < args.length || activeGroup) {
          const arg = activeGroup ?? args[i++];
          activeGroup = null;
          if (arg === "--") {
            if (dest === unknown) dest.push(arg);
            dest.push(...args.slice(i));
            break;
          }
          if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
            this.emit(`option:${activeVariadicOption.name()}`, arg);
            continue;
          }
          activeVariadicOption = null;
          if (maybeOption(arg)) {
            const option = this._findOption(arg);
            if (option) {
              if (option.required) {
                const value = args[i++];
                if (value === void 0) this.optionMissingArgument(option);
                this.emit(`option:${option.name()}`, value);
              } else if (option.optional) {
                let value = null;
                if (i < args.length && (!maybeOption(args[i]) || negativeNumberArg(args[i]))) {
                  value = args[i++];
                }
                this.emit(`option:${option.name()}`, value);
              } else {
                this.emit(`option:${option.name()}`);
              }
              activeVariadicOption = option.variadic ? option : null;
              continue;
            }
          }
          if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
            const option = this._findOption(`-${arg[1]}`);
            if (option) {
              if (option.required || option.optional && this._combineFlagAndOptionalValue) {
                this.emit(`option:${option.name()}`, arg.slice(2));
              } else {
                this.emit(`option:${option.name()}`);
                activeGroup = `-${arg.slice(2)}`;
              }
              continue;
            }
          }
          if (/^--[^=]+=/.test(arg)) {
            const index = arg.indexOf("=");
            const option = this._findOption(arg.slice(0, index));
            if (option && (option.required || option.optional)) {
              this.emit(`option:${option.name()}`, arg.slice(index + 1));
              continue;
            }
          }
          if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) {
            dest = unknown;
          }
          if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
            if (this._findCommand(arg)) {
              operands.push(arg);
              unknown.push(...args.slice(i));
              break;
            } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
              operands.push(arg, ...args.slice(i));
              break;
            } else if (this._defaultCommandName) {
              unknown.push(arg, ...args.slice(i));
              break;
            }
          }
          if (this._passThroughOptions) {
            dest.push(arg, ...args.slice(i));
            break;
          }
          dest.push(arg);
        }
        return { operands, unknown };
      }
      /**
       * Return an object containing local option values as key-value pairs.
       *
       * @return {object}
       */
      opts() {
        if (this._storeOptionsAsProperties) {
          const result = {};
          const len = this.options.length;
          for (let i = 0; i < len; i++) {
            const key = this.options[i].attributeName();
            result[key] = key === this._versionOptionName ? this._version : this[key];
          }
          return result;
        }
        return this._optionValues;
      }
      /**
       * Return an object containing merged local and global option values as key-value pairs.
       *
       * @return {object}
       */
      optsWithGlobals() {
        return this._getCommandAndAncestors().reduce(
          (combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()),
          {}
        );
      }
      /**
       * Display error message and exit (or call exitOverride).
       *
       * @param {string} message
       * @param {object} [errorOptions]
       * @param {string} [errorOptions.code] - an id string representing the error
       * @param {number} [errorOptions.exitCode] - used with process.exit
       */
      error(message, errorOptions) {
        this._outputConfiguration.outputError(
          `${message}
`,
          this._outputConfiguration.writeErr
        );
        if (typeof this._showHelpAfterError === "string") {
          this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
        } else if (this._showHelpAfterError) {
          this._outputConfiguration.writeErr("\n");
          this.outputHelp({ error: true });
        }
        const config = errorOptions || {};
        const exitCode = config.exitCode || 1;
        const code = config.code || "commander.error";
        this._exit(exitCode, code, message);
      }
      /**
       * Apply any option related environment variables, if option does
       * not have a value from cli or client code.
       *
       * @private
       */
      _parseOptionsEnv() {
        this.options.forEach((option) => {
          if (option.envVar && option.envVar in process2.env) {
            const optionKey = option.attributeName();
            if (this.getOptionValue(optionKey) === void 0 || ["default", "config", "env"].includes(
              this.getOptionValueSource(optionKey)
            )) {
              if (option.required || option.optional) {
                this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
              } else {
                this.emit(`optionEnv:${option.name()}`);
              }
            }
          }
        });
      }
      /**
       * Apply any implied option values, if option is undefined or default value.
       *
       * @private
       */
      _parseOptionsImplied() {
        const dualHelper = new DualOptions(this.options);
        const hasCustomOptionValue = (optionKey) => {
          return this.getOptionValue(optionKey) !== void 0 && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
        };
        this.options.filter(
          (option) => option.implied !== void 0 && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(
            this.getOptionValue(option.attributeName()),
            option
          )
        ).forEach((option) => {
          Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
            this.setOptionValueWithSource(
              impliedKey,
              option.implied[impliedKey],
              "implied"
            );
          });
        });
      }
      /**
       * Argument `name` is missing.
       *
       * @param {string} name
       * @private
       */
      missingArgument(name) {
        const message = `error: missing required argument '${name}'`;
        this.error(message, { code: "commander.missingArgument" });
      }
      /**
       * `Option` is missing an argument.
       *
       * @param {Option} option
       * @private
       */
      optionMissingArgument(option) {
        const message = `error: option '${option.flags}' argument missing`;
        this.error(message, { code: "commander.optionMissingArgument" });
      }
      /**
       * `Option` does not have a value, and is a mandatory option.
       *
       * @param {Option} option
       * @private
       */
      missingMandatoryOptionValue(option) {
        const message = `error: required option '${option.flags}' not specified`;
        this.error(message, { code: "commander.missingMandatoryOptionValue" });
      }
      /**
       * `Option` conflicts with another option.
       *
       * @param {Option} option
       * @param {Option} conflictingOption
       * @private
       */
      _conflictingOption(option, conflictingOption) {
        const findBestOptionFromValue = (option2) => {
          const optionKey = option2.attributeName();
          const optionValue = this.getOptionValue(optionKey);
          const negativeOption = this.options.find(
            (target) => target.negate && optionKey === target.attributeName()
          );
          const positiveOption = this.options.find(
            (target) => !target.negate && optionKey === target.attributeName()
          );
          if (negativeOption && (negativeOption.presetArg === void 0 && optionValue === false || negativeOption.presetArg !== void 0 && optionValue === negativeOption.presetArg)) {
            return negativeOption;
          }
          return positiveOption || option2;
        };
        const getErrorMessage = (option2) => {
          const bestOption = findBestOptionFromValue(option2);
          const optionKey = bestOption.attributeName();
          const source = this.getOptionValueSource(optionKey);
          if (source === "env") {
            return `environment variable '${bestOption.envVar}'`;
          }
          return `option '${bestOption.flags}'`;
        };
        const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
        this.error(message, { code: "commander.conflictingOption" });
      }
      /**
       * Unknown option `flag`.
       *
       * @param {string} flag
       * @private
       */
      unknownOption(flag) {
        if (this._allowUnknownOption) return;
        let suggestion = "";
        if (flag.startsWith("--") && this._showSuggestionAfterError) {
          let candidateFlags = [];
          let command = this;
          do {
            const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
            candidateFlags = candidateFlags.concat(moreFlags);
            command = command.parent;
          } while (command && !command._enablePositionalOptions);
          suggestion = suggestSimilar(flag, candidateFlags);
        }
        const message = `error: unknown option '${flag}'${suggestion}`;
        this.error(message, { code: "commander.unknownOption" });
      }
      /**
       * Excess arguments, more than expected.
       *
       * @param {string[]} receivedArgs
       * @private
       */
      _excessArguments(receivedArgs) {
        if (this._allowExcessArguments) return;
        const expected = this.registeredArguments.length;
        const s = expected === 1 ? "" : "s";
        const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
        const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
        this.error(message, { code: "commander.excessArguments" });
      }
      /**
       * Unknown command.
       *
       * @private
       */
      unknownCommand() {
        const unknownName = this.args[0];
        let suggestion = "";
        if (this._showSuggestionAfterError) {
          const candidateNames = [];
          this.createHelp().visibleCommands(this).forEach((command) => {
            candidateNames.push(command.name());
            if (command.alias()) candidateNames.push(command.alias());
          });
          suggestion = suggestSimilar(unknownName, candidateNames);
        }
        const message = `error: unknown command '${unknownName}'${suggestion}`;
        this.error(message, { code: "commander.unknownCommand" });
      }
      /**
       * Get or set the program version.
       *
       * This method auto-registers the "-V, --version" option which will print the version number.
       *
       * You can optionally supply the flags and description to override the defaults.
       *
       * @param {string} [str]
       * @param {string} [flags]
       * @param {string} [description]
       * @return {(this | string | undefined)} `this` command for chaining, or version string if no arguments
       */
      version(str, flags, description) {
        if (str === void 0) return this._version;
        this._version = str;
        flags = flags || "-V, --version";
        description = description || "output the version number";
        const versionOption = this.createOption(flags, description);
        this._versionOptionName = versionOption.attributeName();
        this._registerOption(versionOption);
        this.on("option:" + versionOption.name(), () => {
          this._outputConfiguration.writeOut(`${str}
`);
          this._exit(0, "commander.version", str);
        });
        return this;
      }
      /**
       * Set the description.
       *
       * @param {string} [str]
       * @param {object} [argsDescription]
       * @return {(string|Command)}
       */
      description(str, argsDescription) {
        if (str === void 0 && argsDescription === void 0)
          return this._description;
        this._description = str;
        if (argsDescription) {
          this._argsDescription = argsDescription;
        }
        return this;
      }
      /**
       * Set the summary. Used when listed as subcommand of parent.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      summary(str) {
        if (str === void 0) return this._summary;
        this._summary = str;
        return this;
      }
      /**
       * Set an alias for the command.
       *
       * You may call more than once to add multiple aliases. Only the first alias is shown in the auto-generated help.
       *
       * @param {string} [alias]
       * @return {(string|Command)}
       */
      alias(alias) {
        if (alias === void 0) return this._aliases[0];
        let command = this;
        if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
          command = this.commands[this.commands.length - 1];
        }
        if (alias === command._name)
          throw new Error("Command alias can't be the same as its name");
        const matchingCommand = this.parent?._findCommand(alias);
        if (matchingCommand) {
          const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
          throw new Error(
            `cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`
          );
        }
        command._aliases.push(alias);
        return this;
      }
      /**
       * Set aliases for the command.
       *
       * Only the first alias is shown in the auto-generated help.
       *
       * @param {string[]} [aliases]
       * @return {(string[]|Command)}
       */
      aliases(aliases) {
        if (aliases === void 0) return this._aliases;
        aliases.forEach((alias) => this.alias(alias));
        return this;
      }
      /**
       * Set / get the command usage `str`.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      usage(str) {
        if (str === void 0) {
          if (this._usage) return this._usage;
          const args = this.registeredArguments.map((arg) => {
            return humanReadableArgName(arg);
          });
          return [].concat(
            this.options.length || this._helpOption !== null ? "[options]" : [],
            this.commands.length ? "[command]" : [],
            this.registeredArguments.length ? args : []
          ).join(" ");
        }
        this._usage = str;
        return this;
      }
      /**
       * Get or set the name of the command.
       *
       * @param {string} [str]
       * @return {(string|Command)}
       */
      name(str) {
        if (str === void 0) return this._name;
        this._name = str;
        return this;
      }
      /**
       * Set/get the help group heading for this subcommand in parent command's help.
       *
       * @param {string} [heading]
       * @return {Command | string}
       */
      helpGroup(heading) {
        if (heading === void 0) return this._helpGroupHeading ?? "";
        this._helpGroupHeading = heading;
        return this;
      }
      /**
       * Set/get the default help group heading for subcommands added to this command.
       * (This does not override a group set directly on the subcommand using .helpGroup().)
       *
       * @example
       * program.commandsGroup('Development Commands:);
       * program.command('watch')...
       * program.command('lint')...
       * ...
       *
       * @param {string} [heading]
       * @returns {Command | string}
       */
      commandsGroup(heading) {
        if (heading === void 0) return this._defaultCommandGroup ?? "";
        this._defaultCommandGroup = heading;
        return this;
      }
      /**
       * Set/get the default help group heading for options added to this command.
       * (This does not override a group set directly on the option using .helpGroup().)
       *
       * @example
       * program
       *   .optionsGroup('Development Options:')
       *   .option('-d, --debug', 'output extra debugging')
       *   .option('-p, --profile', 'output profiling information')
       *
       * @param {string} [heading]
       * @returns {Command | string}
       */
      optionsGroup(heading) {
        if (heading === void 0) return this._defaultOptionGroup ?? "";
        this._defaultOptionGroup = heading;
        return this;
      }
      /**
       * @param {Option} option
       * @private
       */
      _initOptionGroup(option) {
        if (this._defaultOptionGroup && !option.helpGroupHeading)
          option.helpGroup(this._defaultOptionGroup);
      }
      /**
       * @param {Command} cmd
       * @private
       */
      _initCommandGroup(cmd) {
        if (this._defaultCommandGroup && !cmd.helpGroup())
          cmd.helpGroup(this._defaultCommandGroup);
      }
      /**
       * Set the name of the command from script filename, such as process.argv[1],
       * or require.main.filename, or __filename.
       *
       * (Used internally and public although not documented in README.)
       *
       * @example
       * program.nameFromFilename(require.main.filename);
       *
       * @param {string} filename
       * @return {Command}
       */
      nameFromFilename(filename) {
        this._name = path.basename(filename, path.extname(filename));
        return this;
      }
      /**
       * Get or set the directory for searching for executable subcommands of this command.
       *
       * @example
       * program.executableDir(__dirname);
       * // or
       * program.executableDir('subcommands');
       *
       * @param {string} [path]
       * @return {(string|null|Command)}
       */
      executableDir(path2) {
        if (path2 === void 0) return this._executableDir;
        this._executableDir = path2;
        return this;
      }
      /**
       * Return program help documentation.
       *
       * @param {{ error: boolean }} [contextOptions] - pass {error:true} to wrap for stderr instead of stdout
       * @return {string}
       */
      helpInformation(contextOptions) {
        const helper = this.createHelp();
        const context = this._getOutputContext(contextOptions);
        helper.prepareContext({
          error: context.error,
          helpWidth: context.helpWidth,
          outputHasColors: context.hasColors
        });
        const text = helper.formatHelp(this, helper);
        if (context.hasColors) return text;
        return this._outputConfiguration.stripColor(text);
      }
      /**
       * @typedef HelpContext
       * @type {object}
       * @property {boolean} error
       * @property {number} helpWidth
       * @property {boolean} hasColors
       * @property {function} write - includes stripColor if needed
       *
       * @returns {HelpContext}
       * @private
       */
      _getOutputContext(contextOptions) {
        contextOptions = contextOptions || {};
        const error = !!contextOptions.error;
        let baseWrite;
        let hasColors;
        let helpWidth;
        if (error) {
          baseWrite = (str) => this._outputConfiguration.writeErr(str);
          hasColors = this._outputConfiguration.getErrHasColors();
          helpWidth = this._outputConfiguration.getErrHelpWidth();
        } else {
          baseWrite = (str) => this._outputConfiguration.writeOut(str);
          hasColors = this._outputConfiguration.getOutHasColors();
          helpWidth = this._outputConfiguration.getOutHelpWidth();
        }
        const write = (str) => {
          if (!hasColors) str = this._outputConfiguration.stripColor(str);
          return baseWrite(str);
        };
        return { error, write, hasColors, helpWidth };
      }
      /**
       * Output help information for this command.
       *
       * Outputs built-in help, and custom text added using `.addHelpText()`.
       *
       * @param {{ error: boolean } | Function} [contextOptions] - pass {error:true} to write to stderr instead of stdout
       */
      outputHelp(contextOptions) {
        let deprecatedCallback;
        if (typeof contextOptions === "function") {
          deprecatedCallback = contextOptions;
          contextOptions = void 0;
        }
        const outputContext = this._getOutputContext(contextOptions);
        const eventContext = {
          error: outputContext.error,
          write: outputContext.write,
          command: this
        };
        this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
        this.emit("beforeHelp", eventContext);
        let helpInformation = this.helpInformation({ error: outputContext.error });
        if (deprecatedCallback) {
          helpInformation = deprecatedCallback(helpInformation);
          if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
            throw new Error("outputHelp callback must return a string or a Buffer");
          }
        }
        outputContext.write(helpInformation);
        if (this._getHelpOption()?.long) {
          this.emit(this._getHelpOption().long);
        }
        this.emit("afterHelp", eventContext);
        this._getCommandAndAncestors().forEach(
          (command) => command.emit("afterAllHelp", eventContext)
        );
      }
      /**
       * You can pass in flags and a description to customise the built-in help option.
       * Pass in false to disable the built-in help option.
       *
       * @example
       * program.helpOption('-?, --help' 'show help'); // customise
       * program.helpOption(false); // disable
       *
       * @param {(string | boolean)} flags
       * @param {string} [description]
       * @return {Command} `this` command for chaining
       */
      helpOption(flags, description) {
        if (typeof flags === "boolean") {
          if (flags) {
            if (this._helpOption === null) this._helpOption = void 0;
            if (this._defaultOptionGroup) {
              this._initOptionGroup(this._getHelpOption());
            }
          } else {
            this._helpOption = null;
          }
          return this;
        }
        this._helpOption = this.createOption(
          flags ?? "-h, --help",
          description ?? "display help for command"
        );
        if (flags || description) this._initOptionGroup(this._helpOption);
        return this;
      }
      /**
       * Lazy create help option.
       * Returns null if has been disabled with .helpOption(false).
       *
       * @returns {(Option | null)} the help option
       * @package
       */
      _getHelpOption() {
        if (this._helpOption === void 0) {
          this.helpOption(void 0, void 0);
        }
        return this._helpOption;
      }
      /**
       * Supply your own option to use for the built-in help option.
       * This is an alternative to using helpOption() to customise the flags and description etc.
       *
       * @param {Option} option
       * @return {Command} `this` command for chaining
       */
      addHelpOption(option) {
        this._helpOption = option;
        this._initOptionGroup(option);
        return this;
      }
      /**
       * Output help information and exit.
       *
       * Outputs built-in help, and custom text added using `.addHelpText()`.
       *
       * @param {{ error: boolean }} [contextOptions] - pass {error:true} to write to stderr instead of stdout
       */
      help(contextOptions) {
        this.outputHelp(contextOptions);
        let exitCode = Number(process2.exitCode ?? 0);
        if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
          exitCode = 1;
        }
        this._exit(exitCode, "commander.help", "(outputHelp)");
      }
      /**
       * // Do a little typing to coordinate emit and listener for the help text events.
       * @typedef HelpTextEventContext
       * @type {object}
       * @property {boolean} error
       * @property {Command} command
       * @property {function} write
       */
      /**
       * Add additional text to be displayed with the built-in help.
       *
       * Position is 'before' or 'after' to affect just this command,
       * and 'beforeAll' or 'afterAll' to affect this command and all its subcommands.
       *
       * @param {string} position - before or after built-in help
       * @param {(string | Function)} text - string to add, or a function returning a string
       * @return {Command} `this` command for chaining
       */
      addHelpText(position, text) {
        const allowedValues = ["beforeAll", "before", "after", "afterAll"];
        if (!allowedValues.includes(position)) {
          throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
        }
        const helpEvent = `${position}Help`;
        this.on(helpEvent, (context) => {
          let helpStr;
          if (typeof text === "function") {
            helpStr = text({ error: context.error, command: context.command });
          } else {
            helpStr = text;
          }
          if (helpStr) {
            context.write(`${helpStr}
`);
          }
        });
        return this;
      }
      /**
       * Output help information if help flags specified
       *
       * @param {Array} args - array of options to search for help flags
       * @private
       */
      _outputHelpIfRequested(args) {
        const helpOption = this._getHelpOption();
        const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
        if (helpRequested) {
          this.outputHelp();
          this._exit(0, "commander.helpDisplayed", "(outputHelp)");
        }
      }
    };
    function incrementNodeInspectorPort(args) {
      return args.map((arg) => {
        if (!arg.startsWith("--inspect")) {
          return arg;
        }
        let debugOption;
        let debugHost = "127.0.0.1";
        let debugPort = "9229";
        let match;
        if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
          debugOption = match[1];
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
          debugOption = match[1];
          if (/^\d+$/.test(match[3])) {
            debugPort = match[3];
          } else {
            debugHost = match[3];
          }
        } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
          debugOption = match[1];
          debugHost = match[3];
          debugPort = match[4];
        }
        if (debugOption && debugPort !== "0") {
          return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
        }
        return arg;
      });
    }
    function useColor() {
      if (process2.env.NO_COLOR || process2.env.FORCE_COLOR === "0" || process2.env.FORCE_COLOR === "false")
        return false;
      if (process2.env.FORCE_COLOR || process2.env.CLICOLOR_FORCE !== void 0)
        return true;
      return void 0;
    }
    exports.Command = Command2;
    exports.useColor = useColor;
  }
});

// node_modules/commander/index.js
var require_commander = __commonJS({
  "node_modules/commander/index.js"(exports) {
    var { Argument: Argument2 } = require_argument();
    var { Command: Command2 } = require_command();
    var { CommanderError: CommanderError2, InvalidArgumentError: InvalidArgumentError2 } = require_error();
    var { Help: Help2 } = require_help();
    var { Option: Option2 } = require_option();
    exports.program = new Command2();
    exports.createCommand = (name) => new Command2(name);
    exports.createOption = (flags, description) => new Option2(flags, description);
    exports.createArgument = (name, description) => new Argument2(name, description);
    exports.Command = Command2;
    exports.Option = Option2;
    exports.Argument = Argument2;
    exports.Help = Help2;
    exports.CommanderError = CommanderError2;
    exports.InvalidArgumentError = InvalidArgumentError2;
    exports.InvalidOptionArgumentError = InvalidArgumentError2;
  }
});

// node_modules/commander/esm.mjs
var import_index = __toESM(require_commander(), 1);
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError,
  InvalidArgumentError,
  InvalidOptionArgumentError,
  // deprecated old name
  Command,
  Argument,
  Option,
  Help
} = import_index.default;

// src/defaultBackendServerUrl.ts
var mountedApiBaseFromBuiltAssets = (origin) => {
  const script = document.querySelector('script[type="module"][src*="/assets/"]');
  const src = script?.getAttribute("src");
  if (!src) return "";
  const scriptPath = new URL(src, origin).pathname;
  const assetsIndex = scriptPath.indexOf("/assets/");
  if (assetsIndex <= 0) return "";
  const basePath = scriptPath.slice(0, assetsIndex).replace(/\/+$/, "");
  return basePath ? `${origin}${basePath}/api` : "";
};
var defaultBackendServerUrl = () => {
  const env = import.meta.env ?? {};
  if (env.VITE_TM_BACKEND_SERVER_URL) {
    return env.VITE_TM_BACKEND_SERVER_URL;
  }
  if (env.VITE_WDIO_TAURI === "1" && env.VITE_TM_TAURI_FUNCTIONAL_BACKEND_URL) {
    return env.VITE_TM_TAURI_FUNCTIONAL_BACKEND_URL;
  }
  if (typeof window === "undefined") return "http://127.0.0.1:8787";
  const { protocol, hostname: hostname2, origin } = window.location;
  if (protocol === "http:" || protocol === "https:") {
    const isLocalHost = hostname2 === "127.0.0.1" || hostname2 === "localhost" || hostname2 === "::1";
    if (!isLocalHost) return mountedApiBaseFromBuiltAssets(origin) || origin;
  }
  return "http://127.0.0.1:8787";
};

// src/initialSeedData.ts
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var starterProject = {
  id: "project_starter",
  name: "TimeManage \u56E2\u961F\u8FDB\u5EA6",
  description: "\u4ECE\u4E2A\u4EBA\u65F6\u95F4\u7BA1\u7406\u8FC1\u79FB\u800C\u6765\u7684\u56E2\u961F\u8FDB\u5EA6\u7BA1\u63A7\u8D77\u59CB\u9879\u76EE\u3002",
  defaultExpectedStartHours: 24,
  taskStageMode: "software",
  sortOrder: 0,
  createdAt: now(),
  updatedAt: now()
};
var starterProjectMember = {
  id: "member_owner",
  projectId: starterProject.id,
  accountId: "account_owner",
  name: "\u9879\u76EE\u8D1F\u8D23\u4EBA",
  email: "owner@example.com",
  roles: ["project_owner", "executor"],
  status: "active",
  createdAt: now(),
  updatedAt: now()
};
var defaultTaskTemplates = [
  {
    id: "template_morning_plan",
    name: "\u6668\u95F4\u8BA1\u5212",
    description: "\u542F\u52A8\u5F53\u5929\u627F\u8BFA\u3001\u68C0\u67E5\u63D0\u9192\u3001\u7559\u51FA\u7F13\u51B2\u3002",
    project: "\u4E2A\u4EBA\u8282\u594F",
    tags: ["\u8BA1\u5212", "\u6668\u95F4"],
    priority: "high",
    severity: "medium",
    estimatePomodoros: 1,
    subtasks: ["\u67E5\u770B\u6628\u65E5\u8FDB\u5C55", "\u9009\u62E9\u4ECA\u65E5 1-3 \u4E2A\u627F\u8BFA", "\u5F00\u542F\u7B2C\u4E00\u9897\u756A\u8304"],
    repeatRule: "daily"
  },
  {
    id: "template_weekly_sync",
    name: "\u5468\u8BA1\u5212\u534F\u4F5C",
    description: "\u6574\u7406\u672C\u5468\u8FDB\u5C55\u3001\u98CE\u9669\u548C\u4E0B\u5468\u5B89\u6392\u3002",
    project: "\u534F\u4F5C",
    tags: ["\u5468\u4F1A", "\u8BA1\u5212"],
    priority: "high",
    severity: "high",
    estimatePomodoros: 2,
    subtasks: ["\u6574\u7406\u5DF2\u5B8C\u6210\u4E8B\u9879", "\u5217\u51FA\u4E3B\u8981\u98CE\u9669", "\u786E\u8BA4\u4E0B\u5468\u5B89\u6392"],
    repeatRule: "weekly"
  },
  {
    id: "template_deep_dev",
    name: "\u5F00\u53D1\u4E13\u6CE8",
    description: "\u7528\u4E8E\u9700\u8981\u8FDE\u7EED\u63A8\u8FDB\u7684\u5F00\u53D1\u4EFB\u52A1\u3002",
    project: "\u5F00\u53D1",
    tags: ["\u5F00\u53D1", "\u6DF1\u5EA6\u5DE5\u4F5C"],
    priority: "high",
    severity: "high",
    estimatePomodoros: 4,
    subtasks: ["\u660E\u786E\u9A8C\u6536\u70B9", "\u5B9E\u73B0\u6700\u5C0F\u95ED\u73AF", "\u8FD0\u884C\u6D4B\u8BD5", "\u8BB0\u5F55\u9057\u7559\u95EE\u9898"]
  },
  {
    id: "template_learning",
    name: "\u5B66\u4E60\u8BA1\u5212",
    description: "\u8BFB\u8D44\u6599\u3001\u505A\u7B14\u8BB0\u3001\u8F93\u51FA\u7EC3\u4E60\u3002",
    project: "\u5B66\u4E60",
    tags: ["\u5B66\u4E60", "\u8F93\u5165"],
    priority: "medium",
    severity: "medium",
    estimatePomodoros: 3,
    subtasks: ["\u9605\u8BFB\u8D44\u6599", "\u6574\u7406\u7B14\u8BB0", "\u505A\u4E00\u6B21\u8F93\u51FA\u7EC3\u4E60"]
  }
];

// src/seed.ts
var padDatePart = (value) => String(value).padStart(2, "0");
var todayKey = (date = /* @__PURE__ */ new Date()) => `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
var uid = (prefix) => {
  const value = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${value}`;
};
var now2 = () => (/* @__PURE__ */ new Date()).toISOString();
var createInitialState = () => ({
  version: 2,
  settings: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    autoStartBreaks: false,
    autoStartFocus: false,
    notificationsEnabled: true,
    soundEnabled: true,
    whiteNoise: "off",
    whiteNoiseVolume: 35,
    timerEndSound: "soft",
    timerEndSoundVolume: 100,
    timerEndSoundRepeats: 1,
    notificationSettings: {
      permissionState: "unknown"
    },
    advancedBackendVisible: false,
    commandPaletteHintDismissed: false,
    devTimerSpeed100xEnabled: false
  },
  auth: {
    status: "signed_out",
    bootstrapped: void 0,
    message: "\u8BF7\u4F7F\u7528\u7BA1\u7406\u5458\u5206\u914D\u7684\u8D26\u53F7\u767B\u5F55"
  },
  projects: [starterProject],
  projectMembers: [starterProjectMember],
  tasks: [],
  dailyPlans: [],
  focusSessions: [],
  workSessions: [],
  executionSignals: [],
  interruptions: [],
  rewardState: {
    streak: 0,
    dailyGoal: 8,
    badges: ["\u9996\u4E2A\u627F\u8BFA"],
    focusGarden: 0,
    visualProgress: 0
  },
  backend: {
    serverUrl: defaultBackendServerUrl(),
    username: "admin",
    deviceId: uid("device"),
    status: "idle",
    message: "\u672C\u5730\u56E2\u961F\u540E\u53F0\u672A\u8FDE\u63A5"
  },
  taskTemplates: defaultTaskTemplates,
  templateInstances: [],
  updatedAt: now2()
});

// src/appClock.ts
var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
var today = () => todayKey();

// src/appTaskMetadata.ts
var regularTaskStageOptions = [
  { value: "planning", label: "\u89C4\u5212" },
  { value: "execution", label: "\u6267\u884C" },
  { value: "check", label: "\u68C0\u67E5" }
];
var softwareTaskStageOptions = [
  { value: "sales", label: "\u9500\u552E" },
  { value: "requirements", label: "\u9700\u6C42" },
  { value: "design", label: "\u8BBE\u8BA1" },
  { value: "development", label: "\u5F00\u53D1" },
  { value: "testing", label: "\u6D4B\u8BD5" },
  { value: "deployment", label: "\u90E8\u7F72" },
  { value: "acceptance", label: "\u9A8C\u6536" }
];
var taskStageOptions = [
  ...regularTaskStageOptions,
  ...softwareTaskStageOptions
];
var regularTaskStageValues = new Set(regularTaskStageOptions.map((option) => option.value));
var defaultTaskStageForMode = (mode) => mode === "regular" ? "planning" : "requirements";
var labelTaskStage = Object.fromEntries(taskStageOptions.map((option) => [option.value, option.label]));
var emptyTaskDefaults = (timestamp, sortOrder) => ({
  subtasks: [],
  sortOrder,
  actualPomodoros: 0,
  estimateHistory: [],
  repeatRule: "none",
  createdAt: timestamp,
  updatedAt: timestamp
});

// src/workSessionSignals.ts
var createExecutionSignal = (workSession, type, timestamp, payload, idFactory = uid) => ({
  id: idFactory("signal"),
  workspaceId: workSession.workspaceId,
  workSessionId: workSession.id,
  taskId: workSession.taskId,
  executorMemberId: workSession.executorMemberId,
  type,
  createdAt: timestamp,
  payload
});
var sortedByUpdatedAt = (items) => [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

// src/workSessionQueries.ts
var latestActiveOrPausedWorkSession = (state, taskId, workSessionId) => sortedByUpdatedAt(state.workSessions).filter((session) => session.status === "active" || session.status === "paused").find((session) => (workSessionId ? session.id === workSessionId : true) && (taskId ? session.taskId === taskId : true));

// src/memberIdentity.ts
var normalizedEmail = (email) => email?.trim().toLowerCase();
var isActiveProjectMember = (member) => member.status !== "disabled";
var sameMemberIdentity = (left, right) => {
  if (left.id === right.id) return true;
  if (left.accountId && right.accountId && left.accountId === right.accountId) return true;
  if (left.email && right.email && left.email.toLowerCase() === right.email.toLowerCase()) return true;
  return false;
};
var projectMemberMatchesAccount = (_state, member, account) => {
  const accountEmail = normalizedEmail(account.email);
  return Boolean(
    member.accountId === account.id || accountEmail && normalizedEmail(member.email) === accountEmail
  );
};
var currentProjectMemberForAccount = (state) => {
  const account = state.auth.account;
  if (!account) return void 0;
  return state.projectMembers.find((member) => isActiveProjectMember(member) && projectMemberMatchesAccount(state, member, account));
};
var resolveCurrentMember = (state) => state.auth.account ? currentProjectMemberForAccount(state) : state.projectMembers.find(isActiveProjectMember);
var resolveMemberForProject = (state, projectId) => {
  const account = state.auth.account;
  if (account) {
    return state.projectMembers.find(
      (member) => member.projectId === projectId && isActiveProjectMember(member) && projectMemberMatchesAccount(state, member, account)
    );
  }
  const currentMember = resolveCurrentMember(state);
  if (!currentMember) return void 0;
  if (currentMember.projectId === projectId && isActiveProjectMember(currentMember)) return currentMember;
  return state.projectMembers.find(
    (member) => member.projectId === projectId && isActiveProjectMember(member) && sameMemberIdentity(member, currentMember)
  );
};
var resolveMemberIdForProject = (state, projectId) => resolveMemberForProject(state, projectId)?.id;
var projectMemberIdentityIds = (state, currentMember = resolveCurrentMember(state)) => {
  if (!currentMember) return /* @__PURE__ */ new Set();
  return new Set(
    state.projectMembers.filter((member) => isActiveProjectMember(member) && sameMemberIdentity(member, currentMember)).map((member) => member.id)
  );
};

// src/teamProgressUtils.ts
var cleanRoles = (roles) => roles.filter((role, index) => roles.indexOf(role) === index);
var normalizedEmail2 = (email) => email?.trim().toLowerCase();
var clampProgressPercent = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
};

// src/projectMemberState.ts
function addProjectMemberToState(state, projectId, name, email, roles, timestamp = (/* @__PURE__ */ new Date()).toISOString(), idFactory = uid, identity = {}) {
  const project = state.projects.find((item) => item.id === projectId);
  const workspaceId = project?.workspaceId ?? identity.workspaceId ?? state.auth.workspace?.id;
  const normalizedName = name.trim() || "\u65B0\u6210\u5458";
  const normalizedMemberEmail = email.trim() || void 0;
  const existing = state.projectMembers.find(
    (member) => member.projectId === projectId && member.status !== "disabled" && (identity.accountId && member.accountId === identity.accountId || normalizedMemberEmail && normalizedEmail2(member.email) === normalizedEmail2(normalizedMemberEmail) || member.name === normalizedName)
  );
  if (existing) {
    return updateProjectMemberInState(state, {
      ...existing,
      name: normalizedName,
      email: normalizedMemberEmail ?? existing.email,
      roles,
      status: "active"
    }, timestamp);
  }
  return {
    ...state,
    projectMembers: [
      {
        id: idFactory("member"),
        workspaceId,
        projectId,
        accountId: identity.accountId,
        name: normalizedName,
        email: normalizedMemberEmail,
        roles: cleanRoles(roles).length ? cleanRoles(roles) : ["executor"],
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      },
      ...state.projectMembers
    ],
    updatedAt: timestamp
  };
}
function updateProjectMemberInState(state, member, timestamp = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    ...state,
    projectMembers: state.projectMembers.map(
      (item) => item.id === member.id ? {
        ...member,
        accountId: member.accountId,
        name: member.name,
        email: member.email,
        roles: cleanRoles(member.roles).length ? cleanRoles(member.roles) : ["executor"],
        status: member.status ?? "active",
        updatedAt: timestamp
      } : item
    ),
    updatedAt: timestamp
  };
}
function projectMembersForProject(state, projectId) {
  return state.projectMembers.filter((member) => member.projectId === projectId && member.status !== "disabled");
}

// src/dailyPlanScope.ts
var currentDailyPlanOwnerAccountId = (state) => state.auth.account?.id;
var currentDailyPlanWorkspaceId = (state) => state.auth.workspace?.id ?? state.auth.account?.workspaceId;
var workspaceIdForTask = (state, task) => {
  const project = state.projects.find((item) => item.id === task.projectId);
  return project?.workspaceId ?? task.workspaceId ?? currentDailyPlanWorkspaceId(state);
};
var dailyPlanIdForOwnerWorkspaceAndDate = (ownerAccountId, workspaceId, date) => {
  const ownerPart = ownerAccountId ?? "local";
  return workspaceId ? `plan_${ownerPart}_${workspaceId}_${date}` : `plan_${ownerPart}_${date}`;
};
var dailyPlanIdForOwnerAndDate = (ownerAccountId, date) => dailyPlanIdForOwnerWorkspaceAndDate(ownerAccountId, void 0, date);
var dailyPlanIdForDate = (state, date, workspaceId = currentDailyPlanWorkspaceId(state)) => dailyPlanIdForOwnerWorkspaceAndDate(currentDailyPlanOwnerAccountId(state), workspaceId, date);
var dailyPlanBelongsToCurrentAccount = (state, plan) => {
  const ownerAccountId = currentDailyPlanOwnerAccountId(state);
  return ownerAccountId ? plan.ownerAccountId === ownerAccountId : !plan.ownerAccountId;
};
var dailyPlansForCurrentAccount = (state) => state.dailyPlans.filter((plan) => dailyPlanBelongsToCurrentAccount(state, plan));
var dailyPlanBelongsToWorkspace = (plan, workspaceId) => workspaceId ? plan.workspaceId === workspaceId : !plan.workspaceId;
var currentAccountDailyPlansForDate = (state, date) => dailyPlansForCurrentAccount(state).filter((plan) => plan.date === date);
var currentAccountDailyPlanForWorkspaceDate = (state, workspaceId, date) => {
  const candidates = currentAccountDailyPlansForDate(state, date).filter((plan) => dailyPlanBelongsToWorkspace(plan, workspaceId));
  return candidates.find((plan) => plan.id === dailyPlanIdForDate(state, date, workspaceId)) ?? candidates[0];
};
var combinedCurrentAccountDailyPlanForDate = (state, date) => {
  const plans = currentAccountDailyPlansForDate(state, date);
  if (plans.length <= 1) return plans[0];
  const first = plans[0];
  return {
    ...first,
    id: dailyPlanIdForOwnerAndDate(currentDailyPlanOwnerAccountId(state), date),
    workspaceId: void 0,
    capacityPomodoros: plans.reduce((sum, plan) => sum + plan.capacityPomodoros, 0),
    committedTaskIds: Array.from(new Set(plans.flatMap((plan) => plan.committedTaskIds))),
    completedPomodoros: plans.reduce((sum, plan) => sum + plan.completedPomodoros, 0),
    suggestedTaskIds: Array.from(new Set(plans.flatMap((plan) => plan.suggestedTaskIds))),
    updatedAt: plans.reduce((latest, plan) => plan.updatedAt > latest ? plan.updatedAt : latest, first.updatedAt)
  };
};
var currentAccountDailyPlanForDate = (state, date) => {
  const workspacePlan = currentAccountDailyPlanForWorkspaceDate(state, currentDailyPlanWorkspaceId(state), date);
  return workspacePlan ?? combinedCurrentAccountDailyPlanForDate(state, date);
};

// src/domainQueries.ts
var defaultReview = () => ({
  mood: "normal",
  wins: "",
  blockers: "",
  interruptionPattern: "",
  tomorrowFocus: ""
});
var planForDate = (state, date) => combinedCurrentAccountDailyPlanForDate(state, date) ?? currentAccountDailyPlanForDate(state, date);

// src/planningDomain.ts
var taskPriorityScore = (task) => task.priority === "urgent" ? 40 : task.priority === "high" ? 30 : task.priority === "medium" ? 20 : 10;
var dueScore = (task, now3 = /* @__PURE__ */ new Date()) => {
  if (!task.dueAt) return 0;
  const due = new Date(task.dueAt).getTime();
  if (Number.isNaN(due)) return 0;
  const days = Math.ceil((due - now3.getTime()) / 864e5);
  if (days <= 0) return 28;
  if (days <= 1) return 22;
  if (days <= 3) return 14;
  if (days <= 7) return 8;
  return 2;
};
var estimateRiskScore = (task) => {
  const recent = [...task.estimateHistory ?? []].slice(-3);
  const under = recent.filter((entry) => entry.actualPomodoros - entry.estimatedPomodoros >= 2).length;
  return under * 6 + (task.estimatePomodoros > 7 ? 10 : 0);
};
var taskSuggestions = (state, date = todayKey(), limit = 5) => {
  const plan = planForDate(state, date);
  const committedIds = new Set(plan?.committedTaskIds ?? []);
  return [...state.tasks].filter((task) => !committedIds.has(task.id) && (task.status === "pool" || task.status === "in_progress")).map((task) => {
    const score = taskPriorityScore(task) + dueScore(task) + estimateRiskScore(task) - Math.max(0, task.estimatePomodoros - 3);
    const action = task.estimatePomodoros > 7 ? "split" : score < 16 ? "defer" : "commit";
    const reasonParts = [
      task.priority === "urgent" ? "\u7D27\u6025" : task.priority === "high" ? "\u9AD8\u4F18\u5148\u7EA7" : "",
      task.dueAt ? "\u4E34\u8FD1\u5230\u671F" : "",
      task.estimatePomodoros > 7 ? "\u4EFB\u52A1\u8FC7\u5927\uFF0C\u5EFA\u8BAE\u5148\u62C6\u5206" : "",
      estimateRiskScore(task) >= 6 ? "\u5386\u53F2\u5BB9\u6613\u4F4E\u4F30" : ""
    ].filter(Boolean);
    return {
      taskId: task.id,
      score,
      action,
      reason: reasonParts.join(" \xB7 ") || `\u4F30\u7B97 ${task.estimatePomodoros} \u4E2A\u756A\u8304\uFF0C\u9002\u5408\u8865\u5165\u4ECA\u65E5`
    };
  }).sort((left, right) => {
    const leftTask = state.tasks.find((task) => task.id === left.taskId);
    const rightTask = state.tasks.find((task) => task.id === right.taskId);
    return right.score - left.score || (leftTask?.sortOrder ?? 0) - (rightTask?.sortOrder ?? 0);
  }).slice(0, limit);
};
var suggestedTasks = (state, limit = 5) => taskSuggestions(state, todayKey(), limit).filter((item) => item.action !== "defer").map((item) => item.taskId);

// src/progressBoardRisks.ts
var expectedStartForTask = (state, task) => {
  if (task.expectedStartAt) return task.expectedStartAt;
  if (!task.primaryExecutorMemberId) return void 0;
  const project = state.projects.find((item) => item.id === task.projectId);
  const hours = project?.defaultExpectedStartHours;
  if (!hours) return void 0;
  return new Date(new Date(task.createdAt).getTime() + hours * 36e5).toISOString();
};
var latestTaskSignalAt = (state, task) => {
  const values = [
    ...state.executionSignals.filter((signal) => signal.taskId === task.id).map((signal) => signal.createdAt),
    ...state.workSessions.filter((session) => session.taskId === task.id).flatMap((session) => [session.startedAt, session.pausedAt, session.endedAt].filter((value) => Boolean(value))),
    task.progressPercent || task.progressNote ? task.updatedAt : void 0
  ].filter((value) => Boolean(value));
  const sorted = values.sort();
  return sorted[sorted.length - 1];
};
var stalledTaskRisks = (state, now3 = /* @__PURE__ */ new Date()) => {
  const nowTime = now3.getTime();
  const staleAfterMs = 24 * 36e5;
  return state.tasks.filter((task) => task.primaryExecutorMemberId && task.status !== "completed" && task.status !== "split" && task.status !== "archived").flatMap((task) => {
    const expectedStartAt = expectedStartForTask(state, task);
    const expectedFinishAt = task.expectedFinishAt;
    const workAfterExpectedStart = expectedStartAt ? state.workSessions.some((session) => session.taskId === task.id && new Date(session.startedAt).getTime() >= new Date(expectedStartAt).getTime()) : true;
    if (expectedStartAt && nowTime > new Date(expectedStartAt).getTime() && !workAfterExpectedStart) {
      return [{
        taskId: task.id,
        kind: "not_started",
        expectedStartAt,
        expectedFinishAt,
        detail: "\u5DF2\u8D85\u8FC7\u9884\u8BA1\u5F00\u59CB\u65F6\u95F4\uFF0C\u4F46\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u4F1A\u8BDD\u3002"
      }];
    }
    const latestSignalAt = latestTaskSignalAt(state, task);
    if (expectedFinishAt && nowTime > new Date(expectedFinishAt).getTime() && (task.progressPercent ?? 0) < 100) {
      return [{
        taskId: task.id,
        kind: "finish_late",
        expectedStartAt,
        expectedFinishAt,
        latestSignalAt,
        detail: "\u5DF2\u8D85\u8FC7\u9884\u8BA1\u5B8C\u6210\u65F6\u95F4\uFF0C\u4E14\u8FDB\u5EA6\u672A\u5230 100%\u3002"
      }];
    }
    if ((task.status === "in_progress" || state.workSessions.some((session) => session.taskId === task.id)) && latestSignalAt) {
      const latestTime = new Date(latestSignalAt).getTime();
      if (nowTime - latestTime > staleAfterMs && (task.progressPercent ?? 0) < 100) {
        return [{
          taskId: task.id,
          kind: "started_stale",
          expectedStartAt,
          expectedFinishAt,
          latestSignalAt,
          detail: "\u4EFB\u52A1\u5DF2\u7ECF\u5F00\u59CB\uFF0C\u4F46\u8D85\u8FC7 24 \u5C0F\u65F6\u6CA1\u6709\u65B0\u7684\u6267\u884C\u6216\u8FDB\u5C55\u4FE1\u53F7\u3002"
        }];
      }
    }
    return [];
  }).sort((left, right) => {
    const order = { not_started: 0, finish_late: 1, started_stale: 2 };
    return order[left.kind] - order[right.kind] || (left.expectedFinishAt ?? left.expectedStartAt ?? "").localeCompare(right.expectedFinishAt ?? right.expectedStartAt ?? "");
  });
};

// src/progressBoard.ts
var memberName = (state, memberId) => memberId ? state.projectMembers.find((member) => member.id === memberId)?.name : void 0;
var boardTask = (state, task, detail) => ({
  taskId: task.id,
  title: task.title,
  executorName: memberName(state, task.primaryExecutorMemberId),
  progressPercent: task.progressPercent ?? 0,
  progressNote: task.progressNote,
  expectedStartAt: expectedStartForTask(state, task),
  expectedFinishAt: task.expectedFinishAt,
  detail
});
var isBlockedTask = (task) => /阻塞|卡住|blocked|blocker|等待/i.test(`${task.progressNote ?? ""} ${task.reviewReturnReason ?? ""}`);
var nearExpectedFinish = (task, now3) => {
  if (!task.expectedFinishAt || (task.progressPercent ?? 0) >= 100) return false;
  const finish = new Date(task.expectedFinishAt).getTime();
  if (Number.isNaN(finish)) return false;
  const diff = finish - now3.getTime();
  return diff >= 0 && diff <= 24 * 36e5;
};
var hasAnyWorkSession = (sessions, task) => sessions.some((session) => session.taskId === task.id);
var buildProgressBoard = (state, projectId, now3 = /* @__PURE__ */ new Date()) => {
  const project = state.projects.find((item) => item.id === projectId) ?? state.projects[0];
  const tasks = state.tasks.filter((task) => task.projectId === project?.id && task.status !== "archived" && task.status !== "split");
  const progressTasks = tasks.filter((task) => task.status !== "archived" && task.status !== "split");
  const totalWeight = progressTasks.reduce((sum, task) => sum + Math.max(1, task.estimatePomodoros || 1), 0);
  const weightedProgress = totalWeight ? Math.round(progressTasks.reduce((sum, task) => sum + (task.progressPercent ?? (task.status === "completed" ? 100 : 0)) * Math.max(1, task.estimatePomodoros || 1), 0) / totalWeight) : 0;
  const projectSessions = state.workSessions.filter(
    (session) => session.status === "active" && tasks.some((task) => task.id === session.taskId)
  );
  const stalledByTask = new Map(stalledTaskRisks(state, now3).filter((risk) => tasks.some((task) => task.id === risk.taskId)).map((risk) => [risk.taskId, risk]));
  const assignedNotStarted = tasks.filter((task) => task.primaryExecutorMemberId && task.status !== "completed" && task.status !== "pending_review" && !hasAnyWorkSession(state.workSessions, task)).map((task) => boardTask(state, task, stalledByTask.get(task.id)?.detail ?? "\u5DF2\u5206\u914D\uFF0C\u4F46\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u4F1A\u8BDD\u3002"));
  const assignedNotStartedIds = new Set(assignedNotStarted.map((task) => task.taskId));
  const stalled = tasks.filter((task) => stalledByTask.has(task.id) && !assignedNotStartedIds.has(task.id)).map((task) => boardTask(state, task, stalledByTask.get(task.id)?.detail ?? "\u4EFB\u52A1\u51FA\u73B0\u505C\u6EDE\u98CE\u9669\u3002"));
  const stalledIds = new Set(stalled.map((task) => task.taskId));
  const blocked = tasks.filter((task) => !assignedNotStartedIds.has(task.id) && !stalledIds.has(task.id) && isBlockedTask(task)).map((task) => boardTask(state, task, task.reviewReturnReason ? `\u9000\u56DE\u539F\u56E0\uFF1A${task.reviewReturnReason}` : "\u8FDB\u5C55\u8BF4\u660E\u663E\u793A\u4EFB\u52A1\u88AB\u963B\u585E\u3002"));
  const blockedIds = new Set(blocked.map((task) => task.taskId));
  const pendingReview = tasks.filter((task) => task.status === "pending_review" && !blockedIds.has(task.id)).map((task) => boardTask(state, task, "\u7B49\u5F85\u9879\u76EE\u8D1F\u8D23\u4EBA\u9A8C\u6536\u3002"));
  const pendingReviewIds = new Set(pendingReview.map((task) => task.taskId));
  const nearFinish = tasks.filter(
    (task) => !assignedNotStartedIds.has(task.id) && !stalledIds.has(task.id) && !blockedIds.has(task.id) && !pendingReviewIds.has(task.id) && nearExpectedFinish(task, now3)
  ).map((task) => boardTask(state, task, "\u9884\u8BA1\u5B8C\u6210\u65F6\u95F4\u5C06\u5728 24 \u5C0F\u65F6\u5185\u5230\u8FBE\u3002"));
  const riskIds = /* @__PURE__ */ new Set([...assignedNotStartedIds, ...stalledIds, ...blockedIds, ...pendingReviewIds, ...nearFinish.map((task) => task.taskId)]);
  const normal = tasks.filter((task) => task.status !== "completed" && !riskIds.has(task.id)).map((task) => boardTask(state, task, "\u6B63\u5E38\u63A8\u8FDB\u3002"));
  return {
    projectId: project?.id ?? "",
    projectName: project?.name ?? "\u672A\u547D\u540D\u9879\u76EE",
    projectProgress: weightedProgress,
    activeSessions: projectSessions.map((session) => {
      const task = tasks.find((item) => item.id === session.taskId);
      return {
        workSessionId: session.id,
        taskId: session.taskId,
        taskTitle: task?.title ?? "\u672A\u77E5\u4EFB\u52A1",
        executorName: memberName(state, session.executorMemberId),
        startedAt: session.startedAt,
        elapsedSeconds: Math.max(0, Math.round((now3.getTime() - new Date(session.startedAt).getTime()) / 1e3))
      };
    }),
    sections: [
      { kind: "assigned_not_started", title: "\u5DF2\u5206\u914D\u672A\u5F00\u59CB", tasks: assignedNotStarted },
      { kind: "stalled", title: "\u505C\u6EDE\u98CE\u9669", tasks: stalled },
      { kind: "blocked", title: "\u963B\u585E\u4EFB\u52A1", tasks: blocked },
      { kind: "pending_review", title: "\u5F85\u9A8C\u6536", tasks: pendingReview },
      { kind: "near_finish", title: "\u4E34\u8FD1\u9884\u8BA1\u5B8C\u6210", tasks: nearFinish },
      { kind: "normal", title: "\u6B63\u5E38\u5DE5\u4F5C", tasks: normal }
    ]
  };
};

// src/appTodayPlan.ts
var createDailyPlanForDate = (state, date, timestamp = nowIso(), workspaceId = currentDailyPlanWorkspaceId(state)) => ({
  id: dailyPlanIdForDate(state, date, workspaceId),
  workspaceId,
  ownerAccountId: currentDailyPlanOwnerAccountId(state),
  date,
  capacityPomodoros: Math.max(4, state.rewardState.dailyGoal),
  committedTaskIds: [],
  completedPomodoros: 0,
  suggestedTaskIds: date === today() ? suggestedTasks(state) : [],
  reflection: "",
  review: defaultReview(),
  createdAt: timestamp,
  updatedAt: timestamp
});
var getTodayPlan = (state) => {
  const todayDate = today();
  const existing = combinedCurrentAccountDailyPlanForDate(state, todayDate) ?? currentAccountDailyPlanForDate(state, todayDate);
  if (existing) return existing;
  return createDailyPlanForDate(state, todayDate);
};

// src/workSessionTodayPlan.ts
var ensurePlanInState = (state, date, timestamp, workspaceId = currentDailyPlanWorkspaceId(state)) => {
  const existing = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date);
  if (existing) return { state, plan: existing };
  const plan = createDailyPlanForDate(state, date, timestamp, workspaceId);
  return { state: { ...state, dailyPlans: [plan, ...state.dailyPlans], updatedAt: timestamp }, plan };
};
var ensureTodayPlanInState = (state, timestamp, workspaceId = currentDailyPlanWorkspaceId(state)) => ensurePlanInState(state, todayKey(), timestamp, workspaceId);
var currentProjectMemberIdForTask = (state, task) => {
  return resolveMemberIdForProject(state, task.projectId);
};
var taskHasAssignee = (task) => Boolean(task.primaryExecutorMemberId || (task.collaboratorMemberIds ?? []).length > 0);
var currentWorkspaceMembershipForTask = (state, task) => {
  const account = state.auth.account;
  if (!account) return void 0;
  const project = state.projects.find((item) => item.id === task.projectId);
  const workspaceId = project?.workspaceId ?? task.workspaceId ?? currentDailyPlanWorkspaceId(state);
  return state.auth.workspaceMemberships?.find(
    (membership) => membership.status === "active" && membership.accountId === account.id && (!workspaceId || membership.workspaceId === workspaceId)
  ) ?? (state.auth.membership?.status === "active" && state.auth.membership.accountId === account.id && (!workspaceId || state.auth.membership.workspaceId === workspaceId) ? state.auth.membership : void 0);
};
var ensureCurrentProjectMemberForTask = (state, task, timestamp) => {
  const currentMemberId = currentProjectMemberIdForTask(state, task);
  if (currentMemberId) return { state, memberId: currentMemberId };
  const account = state.auth.account;
  const membership = currentWorkspaceMembershipForTask(state, task);
  if (!account || !membership) return { state, memberId: void 0 };
  const project = state.projects.find((item) => item.id === task.projectId);
  const nextState = addProjectMemberToState(
    state,
    task.projectId,
    account.name || membership.name,
    account.email || membership.email,
    ["executor"],
    timestamp,
    uid,
    {
      accountId: account.id,
      workspaceId: project?.workspaceId ?? task.workspaceId ?? membership.workspaceId
    }
  );
  return { state: nextState, memberId: currentProjectMemberIdForTask(nextState, task) };
};
var claimTaskForCurrentMemberIfUnassigned = (state, task) => {
  if (taskHasAssignee(task)) return task.primaryExecutorMemberId;
  return currentProjectMemberIdForTask(state, task);
};
var addTaskToTodayInState = (state, taskId, timestamp) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const stateWithMember = taskHasAssignee(task) ? state : ensureCurrentProjectMemberForTask(state, task, timestamp).state;
  const taskForPlan = stateWithMember.tasks.find((item) => item.id === taskId) ?? task;
  const { state: withPlan, plan } = ensureTodayPlanInState(stateWithMember, timestamp, workspaceIdForTask(stateWithMember, taskForPlan));
  const committedTaskIds = Array.from(/* @__PURE__ */ new Set([...plan.committedTaskIds, taskId]));
  return {
    ...withPlan,
    tasks: withPlan.tasks.map(
      (item) => item.id === taskId ? {
        ...item,
        primaryExecutorMemberId: claimTaskForCurrentMemberIfUnassigned(withPlan, item),
        status: item.status === "pool" ? "committed" : item.status,
        updatedAt: timestamp
      } : item
    ),
    dailyPlans: withPlan.dailyPlans.map((item) => item.id === plan.id ? { ...item, committedTaskIds, updatedAt: timestamp } : item),
    updatedAt: timestamp
  };
};
var claimTodayPlanTasksForCurrentMemberInState = (state, plan, timestamp) => {
  let nextState = state;
  let changed = false;
  for (const taskId of plan.committedTaskIds) {
    const task = nextState.tasks.find((item) => item.id === taskId);
    if (!task || taskHasAssignee(task)) continue;
    const withMember = ensureCurrentProjectMemberForTask(nextState, task, timestamp);
    if (!withMember.memberId) continue;
    nextState = {
      ...withMember.state,
      tasks: withMember.state.tasks.map(
        (item) => item.id === task.id ? { ...item, primaryExecutorMemberId: withMember.memberId, updatedAt: timestamp } : item
      ),
      updatedAt: timestamp
    };
    changed = true;
  }
  return changed ? nextState : state;
};

// src/workSessionTermination.ts
var endActiveWorkSessionsForTaskInState = (state, taskId, timestamp, options = {}) => {
  const sessionsToEnd = state.workSessions.filter(
    (session) => session.taskId === taskId && (session.status === "active" || session.status === "paused")
  );
  const shouldClearActiveTimer = options.clearActiveTimer && state.activeTimer?.taskId === taskId;
  if (sessionsToEnd.length === 0 && !shouldClearActiveTimer) return state;
  const endedSessionIds = new Set(sessionsToEnd.map((session) => session.id));
  const endedFocusSessionIds = new Set(sessionsToEnd.map((session) => session.focusSessionId).filter(Boolean));
  const nextWorkSessions = state.workSessions.map(
    (session) => endedSessionIds.has(session.id) ? {
      ...session,
      status: "ended",
      pausedAt: void 0,
      endedAt: timestamp,
      totalPausedSeconds: options.activeTimerWorkSessionId === session.id && options.activeTimerTotalPausedSeconds !== void 0 ? options.activeTimerTotalPausedSeconds : session.totalPausedSeconds,
      updatedAt: timestamp
    } : session
  );
  const endedWorkSessions = nextWorkSessions.filter((session) => endedSessionIds.has(session.id));
  const reason = options.reason ?? "removed_from_today";
  return {
    ...state,
    focusSessions: state.focusSessions.map(
      (session) => endedFocusSessionIds.has(session.id) && !session.endedAt ? { ...session, endedAt: timestamp, outcome: "skipped" } : session
    ),
    workSessions: nextWorkSessions,
    executionSignals: [
      ...endedWorkSessions.map(
        (session) => createExecutionSignal(
          session,
          "work_ended",
          timestamp,
          { outcome: "skipped", reason, ...options.source ? { source: options.source } : {} },
          options.idFactory
        )
      ),
      ...state.executionSignals
    ],
    activeTimer: shouldClearActiveTimer ? void 0 : state.activeTimer,
    updatedAt: timestamp
  };
};

// src/workSessionStart.ts
var startWorkSessionInState = (state, taskId, timestamp, options = {}) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (task.status === "pending_review" || task.status === "completed" || task.status === "archived" || task.status === "split") {
    throw new Error(`Task ${taskId} cannot be started from status ${task.status}.`);
  }
  const next = addTaskToTodayInState(state, taskId, timestamp);
  const currentTask = next.tasks.find((item) => item.id === taskId);
  const executorMemberId = currentTask.primaryExecutorMemberId ?? resolveMemberIdForProject(next, currentTask.projectId);
  const activeForExecutor = executorMemberId ? next.workSessions.find((session) => session.status === "active" && session.executorMemberId === executorMemberId) : void 0;
  if (activeForExecutor?.taskId === taskId) return next;
  const endedSession = activeForExecutor ? {
    ...activeForExecutor,
    status: "ended",
    pausedAt: void 0,
    endedAt: timestamp,
    updatedAt: timestamp
  } : void 0;
  const idFactory = options.idFactory ?? uid;
  const workspaceId = currentTask.workspaceId ?? state.projects.find((project) => project.id === currentTask.projectId)?.workspaceId ?? next.auth.workspace?.id;
  const focusSession = {
    id: idFactory("session"),
    workspaceId,
    taskId,
    mode: "focus",
    duration: next.settings.focusMinutes * 60,
    startedAt: timestamp,
    interruptionCounts: { internal: 0, external: 0 }
  };
  const workSession = {
    id: idFactory("work_session"),
    workspaceId,
    taskId,
    executorMemberId,
    focusSessionId: focusSession.id,
    status: "active",
    startedAt: timestamp,
    totalPausedSeconds: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const signals = [
    createExecutionSignal(workSession, "work_started", timestamp, options.source ? { source: options.source } : void 0, idFactory),
    ...endedSession ? [createExecutionSignal(endedSession, "work_ended", timestamp, { outcome: "skipped", reason: "task_switch" }, idFactory)] : []
  ];
  return {
    ...next,
    focusSessions: [focusSession, ...next.focusSessions],
    workSessions: [
      workSession,
      ...next.workSessions.map((session) => endedSession && session.id === endedSession.id ? endedSession : session)
    ],
    executionSignals: [...signals, ...next.executionSignals],
    tasks: next.tasks.map((item) => item.id === taskId ? { ...item, status: "in_progress", updatedAt: timestamp } : item),
    updatedAt: timestamp
  };
};

// src/workSessionPauseResume.ts
var pauseWorkSessionInState = (state, timestamp, taskId, workSessionId, options = {}) => {
  const session = latestActiveOrPausedWorkSession(state, taskId, workSessionId);
  if (!session) throw new Error("No active or paused work session found.");
  if (session.status === "paused") return state;
  const nextSession = { ...session, status: "paused", pausedAt: timestamp, updatedAt: timestamp };
  return {
    ...state,
    workSessions: state.workSessions.map((item) => item.id === session.id ? nextSession : item),
    executionSignals: [
      createExecutionSignal(nextSession, "work_paused", timestamp, options.source ? { source: options.source } : void 0, options.idFactory),
      ...state.executionSignals
    ],
    updatedAt: timestamp
  };
};
var resumeWorkSessionInState = (state, timestamp, taskId, workSessionId, options = {}) => {
  const session = latestActiveOrPausedWorkSession(state, taskId, workSessionId);
  if (!session) throw new Error("No active or paused work session found.");
  if (session.status === "active") return state;
  const pausedSeconds = session.pausedAt ? Math.max(0, Math.round((new Date(timestamp).getTime() - new Date(session.pausedAt).getTime()) / 1e3)) : 0;
  const nextSession = {
    ...session,
    status: "active",
    pausedAt: void 0,
    totalPausedSeconds: (session.totalPausedSeconds ?? 0) + pausedSeconds,
    updatedAt: timestamp
  };
  return {
    ...state,
    workSessions: state.workSessions.map((item) => item.id === session.id ? nextSession : item),
    executionSignals: [
      createExecutionSignal(nextSession, "work_resumed", timestamp, options.source ? { source: options.source } : void 0, options.idFactory),
      ...state.executionSignals
    ],
    updatedAt: timestamp
  };
};

// src/workSessionFinish.ts
var finishWorkSessionInState = (state, timestamp, taskId, workSessionId, options = {}) => {
  const session = latestActiveOrPausedWorkSession(state, taskId, workSessionId);
  if (!session) throw new Error("No active or paused work session found.");
  const outcome = options.outcome ?? "completed";
  const nextSession = { ...session, status: "ended", pausedAt: void 0, endedAt: timestamp, updatedAt: timestamp };
  return {
    ...state,
    workSessions: state.workSessions.map((item) => item.id === session.id ? nextSession : item),
    focusSessions: state.focusSessions.map(
      (item) => item.id === session.focusSessionId ? { ...item, endedAt: timestamp, outcome } : item
    ),
    tasks: state.tasks.map(
      (task) => task.id === session.taskId ? {
        ...task,
        status: task.status === "pending_review" ? task.status : "in_progress",
        actualPomodoros: outcome === "completed" ? (task.actualPomodoros ?? 0) + 1 : task.actualPomodoros,
        updatedAt: timestamp
      } : task
    ),
    executionSignals: [
      createExecutionSignal(
        nextSession,
        "work_ended",
        timestamp,
        { outcome, ...options.source ? { source: options.source } : {} },
        options.idFactory
      ),
      ...state.executionSignals
    ],
    updatedAt: timestamp
  };
};

// src/appTimerWorkSession.ts
var endActiveWorkSessionsForTaskInState2 = (state, taskId, timestamp, reason = "removed_from_today") => endActiveWorkSessionsForTaskInState(state, taskId, timestamp, {
  reason,
  activeTimerWorkSessionId: state.activeTimer?.workSessionId,
  activeTimerTotalPausedSeconds: state.activeTimer?.totalPausedSeconds,
  clearActiveTimer: true
});

// src/appTodayPlanState.ts
var removeTaskFromTodayInState = (state, taskId, timestamp) => {
  const endedState = endActiveWorkSessionsForTaskInState2(state, taskId, timestamp);
  return {
    ...endedState,
    dailyPlans: endedState.dailyPlans.map(
      (item) => item.date === today() && dailyPlanBelongsToCurrentAccount(endedState, item) && item.committedTaskIds.includes(taskId) ? {
        ...item,
        committedTaskIds: item.committedTaskIds.filter((id) => id !== taskId),
        updatedAt: timestamp
      } : item
    ),
    tasks: endedState.tasks.map(
      (task) => task.id === taskId && task.status === "committed" ? { ...task, status: "pool", updatedAt: timestamp } : task
    ),
    updatedAt: timestamp
  };
};
var claimCurrentAccountTodayPlans = (state, date, timestamp) => currentAccountDailyPlansForDate(state, date).reduce(
  (current, plan) => claimTodayPlanTasksForCurrentMemberInState(current, plan, timestamp),
  state
);
var ensureTodayPlan = (state) => {
  const todayDate = today();
  const timestamp = nowIso();
  const activeTimer = state.activeTimer;
  const activeTimerTask = activeTimer?.mode === "focus" && activeTimer.taskId ? state.tasks.find((task) => task.id === activeTimer.taskId) : void 0;
  const hasActiveTimerWorkSession = Boolean(
    activeTimer && state.workSessions.some(
      (session) => activeTimer.workSessionId ? session.id === activeTimer.workSessionId : session.focusSessionId === activeTimer.sessionId
    )
  );
  const repairedState = activeTimer && activeTimerTask && !hasActiveTimerWorkSession ? (() => {
    const workSession = {
      id: activeTimer.workSessionId ?? uid("work_session"),
      taskId: activeTimerTask.id,
      executorMemberId: activeTimerTask.primaryExecutorMemberId ?? resolveMemberIdForProject(state, activeTimerTask.projectId),
      focusSessionId: activeTimer.sessionId,
      status: activeTimer.isRunning ? "active" : "paused",
      startedAt: activeTimer.startedAt,
      pausedAt: activeTimer.pausedAt,
      totalPausedSeconds: activeTimer.totalPausedSeconds,
      createdAt: activeTimer.startedAt,
      updatedAt: timestamp
    };
    return {
      ...state,
      workSessions: [workSession, ...state.workSessions],
      executionSignals: [createExecutionSignal(workSession, "work_started", timestamp, { source: "active_timer_repair" }), ...state.executionSignals],
      activeTimer: { ...activeTimer, workSessionId: workSession.id },
      updatedAt: timestamp
    };
  })() : state;
  const staleActiveTaskIds = repairedState.workSessions.filter((session) => (session.status === "active" || session.status === "paused") && todayKey(new Date(session.startedAt)) !== todayDate).map((session) => session.taskId);
  const normalizedState = staleActiveTaskIds.reduce(
    (current, taskId) => endActiveWorkSessionsForTaskInState2(current, taskId, timestamp, "stale_active_session"),
    repairedState
  );
  const activeTaskIds = normalizedState.workSessions.filter((session) => session.status === "active" || session.status === "paused").map((session) => session.taskId).filter(
    (taskId) => normalizedState.tasks.some(
      (task) => task.id === taskId && task.status !== "completed" && task.status !== "split" && task.status !== "archived"
    )
  );
  let withActiveTasks = normalizedState;
  for (const taskId of activeTaskIds) {
    const task = withActiveTasks.tasks.find((item) => item.id === taskId);
    const { state: withPlan, plan } = ensurePlanInState(withActiveTasks, todayDate, timestamp, task ? workspaceIdForTask(withActiveTasks, task) : void 0);
    withActiveTasks = plan.committedTaskIds.includes(taskId) ? withPlan : {
      ...withPlan,
      dailyPlans: withPlan.dailyPlans.map(
        (item) => item.id === plan.id ? {
          ...item,
          committedTaskIds: Array.from(/* @__PURE__ */ new Set([...item.committedTaskIds, taskId])),
          updatedAt: timestamp
        } : item
      ),
      updatedAt: timestamp
    };
  }
  if (currentAccountDailyPlansForDate(withActiveTasks, todayDate).length === 0) {
    withActiveTasks = ensurePlanInState(withActiveTasks, todayDate, timestamp).state;
  }
  return claimCurrentAccountTodayPlans(withActiveTasks, todayDate, timestamp);
};

// src/appTaskDeletionState.ts
function deleteTaskFromState(state, task, timestamp) {
  const committedPlanIds = state.dailyPlans.filter((plan) => plan.committedTaskIds.includes(task.id)).map((plan) => plan.id);
  const snapshot = { task, committedPlanIds, deletedAt: timestamp };
  return {
    snapshot,
    state: {
      ...state,
      tasks: state.tasks.filter((item) => item.id !== task.id),
      dailyPlans: state.dailyPlans.map((plan) => ({
        ...plan,
        committedTaskIds: plan.committedTaskIds.filter((id) => id !== task.id)
      })),
      updatedAt: timestamp
    }
  };
}

// src/appTaskSplitState.ts
function splitTaskInState(state, task, titles, timestamp, createTaskId) {
  const currentPlan = getTodayPlan(state);
  const committed = task.status === "committed" || currentPlan.committedTaskIds.includes(task.id);
  const workspaceId = workspaceIdForTask(state, task);
  const estimatePerTask = Math.max(1, Math.ceil(task.estimatePomodoros / titles.length));
  const newTasks = titles.map((title, index) => ({
    id: createTaskId(),
    workspaceId,
    title,
    notes: `\u7531\u300C${task.title}\u300D\u62C6\u5206\u800C\u6765\u3002`,
    tags: task.tags,
    projectId: task.projectId,
    project: task.project,
    creatorMemberId: resolveMemberIdForProject(state, task.projectId) ?? task.creatorMemberId,
    primaryExecutorMemberId: task.primaryExecutorMemberId,
    collaboratorMemberIds: task.collaboratorMemberIds ?? [],
    expectedStartAt: task.expectedStartAt,
    expectedFinishAt: task.expectedFinishAt,
    progressPercent: 0,
    progressNote: "",
    priority: task.priority,
    severity: task.severity,
    stage: task.stage,
    estimatePomodoros: estimatePerTask,
    status: committed ? "committed" : "pool",
    ...emptyTaskDefaults(timestamp, task.sortOrder + index + 1),
    dueAt: task.dueAt,
    reminderAt: index === 0 ? task.reminderAt : void 0,
    repeatRule: task.repeatRule,
    repeatIntervalDays: task.repeatIntervalDays
  }));
  return {
    newTasks,
    state: {
      ...state,
      tasks: [
        ...newTasks,
        ...state.tasks.map(
          (item) => item.id === task.id ? {
            ...item,
            status: "split",
            notes: [
              item.notes,
              `\u5DF2\u62C6\u5206\u4E3A\uFF1A${titles.join("\u3001")}\u3002`
            ].filter(Boolean).join("\n"),
            updatedAt: timestamp
          } : item
        )
      ],
      dailyPlans: state.dailyPlans.map((plan) => ({
        ...plan,
        committedTaskIds: plan.committedTaskIds.flatMap((id) => id === task.id ? newTasks.map((item) => item.id) : [id]),
        updatedAt: plan.committedTaskIds.includes(task.id) ? timestamp : plan.updatedAt
      })),
      updatedAt: timestamp
    }
  };
}

// src/appTaskState.ts
function updateTaskInState(state, taskId, updater, timestamp) {
  return {
    ...state,
    tasks: state.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const nextTask = typeof updater === "function" ? updater(task) : { ...task, ...updater };
      return { ...nextTask, updatedAt: timestamp };
    }),
    updatedAt: timestamp
  };
}
function moveCommittedTaskInState(state, taskId, direction, timestamp) {
  const plan = currentAccountDailyPlansForDate(state, today()).find((item) => item.committedTaskIds.includes(taskId));
  if (!plan) return state;
  const index = plan.committedTaskIds.indexOf(taskId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= plan.committedTaskIds.length) return state;
  const committedTaskIds = [...plan.committedTaskIds];
  [committedTaskIds[index], committedTaskIds[nextIndex]] = [committedTaskIds[nextIndex], committedTaskIds[index]];
  return {
    ...state,
    dailyPlans: state.dailyPlans.map(
      (item) => item.id === plan.id ? { ...item, committedTaskIds, updatedAt: timestamp } : item
    ),
    updatedAt: timestamp
  };
}

// src/accessIdentity.ts
var normalizedEmail3 = (email) => email?.trim().toLowerCase();
var memberAccessIdentityKey = (member) => {
  if (member.accountId) return `account:${member.accountId}`;
  if (member.email) return `email:${normalizedEmail3(member.email)}`;
  return `member:${member.id ?? ""}`;
};
var memberAccessIdentityAliases = (member) => {
  const aliases = [];
  if (member.accountId) aliases.push(`account:${member.accountId}`);
  const email = normalizedEmail3(member.email);
  if (email) aliases.push(`email:${email}`);
  if (member.id) aliases.push(`member:${member.id}`);
  return Array.from(new Set(aliases.length ? aliases : [memberAccessIdentityKey(member)]));
};
var addMemberAccessIdentity = (identities, identityAliasToKey, member) => {
  const aliases = memberAccessIdentityAliases(member);
  const existingKey = aliases.map((alias) => identityAliasToKey.get(alias)).find((key) => Boolean(key && identities.has(key)));
  const identityKey = existingKey ?? memberAccessIdentityKey(member);
  aliases.forEach((alias) => identityAliasToKey.set(alias, identityKey));
  identities.add(identityKey);
};
var memberIdentityForProjectMember = (member) => ({
  id: member.id,
  accountId: member.accountId,
  email: member.email
});

// src/workspaceStateAccess.ts
var workspaceMembershipsForState = (state) => {
  const memberships = state.auth.workspaceMemberships ?? [];
  const currentMembership = state.auth.membership;
  if (!currentMembership || memberships.some(
    (membership) => membership.id === currentMembership.id || membership.workspaceId === currentMembership.workspaceId && membership.accountId === currentMembership.accountId
  )) {
    return memberships;
  }
  return [...memberships, currentMembership];
};
var workspacesForState = (state) => state.auth.workspaces ?? (state.auth.workspace ? [state.auth.workspace] : []);
var workspaceForProject = (state, project) => project.workspaceId ? workspacesForState(state).find((item) => item.id === project.workspaceId) ?? (state.auth.workspace?.id === project.workspaceId ? state.auth.workspace : void 0) : state.auth.workspace;
var workspaceIdForProject = (state, project) => project.workspaceId ?? workspaceForProject(state, project)?.id;

// src/workspaceMemberVisibility.ts
var activeWorkspaceIdsForAccount = (state, account) => {
  if (!account?.id) return /* @__PURE__ */ new Set();
  const workspaceMemberships = workspaceMembershipsForState(state);
  const workspaceIds = new Set(
    workspaceMemberships.filter((membership) => membership.accountId === account.id && membership.status === "active").map((membership) => membership.workspaceId)
  );
  workspacesForState(state).filter((workspace) => workspace.ownerAccountId === account.id).forEach((workspace) => workspaceIds.add(workspace.id));
  if (state.auth.workspace?.ownerAccountId === account.id) workspaceIds.add(state.auth.workspace.id);
  return workspaceIds;
};
var activeWorkspaceIdsForCurrentAccount = (state) => activeWorkspaceIdsForAccount(state, state.auth.account);

// src/projectAccessMemberCount.ts
var countProjectAccessibleMembers = (state, project, workspaceId) => {
  const identities = /* @__PURE__ */ new Set();
  const identityAliasToKey = /* @__PURE__ */ new Map();
  if (workspaceId) {
    const workspace = workspacesForState(state).find((item) => item.id === workspaceId);
    if (workspace?.ownerAccountId) addMemberAccessIdentity(identities, identityAliasToKey, { accountId: workspace.ownerAccountId });
    const activeMemberships = workspaceMembershipsForState(state).filter((membership) => membership.workspaceId === workspaceId && membership.status === "active");
    activeMemberships.forEach((membership) => addMemberAccessIdentity(identities, identityAliasToKey, membership));
  }
  state.projectMembers.filter((member) => member.projectId === project.id && member.status !== "disabled").forEach((member) => addMemberAccessIdentity(identities, identityAliasToKey, member));
  return identities.size;
};

// src/projectAccessIdentity.ts
var projectMemberMatchesIdentity = (member, identity) => {
  const identityEmail = normalizedEmail3(identity.email);
  return Boolean(
    identity.accountId && member.accountId === identity.accountId || identityEmail && normalizedEmail3(member.email) === identityEmail
  );
};
var accountIdentity = (account) => ({
  id: account.id,
  accountId: account.id,
  email: account.email
});

// src/projectAccessVisibility.ts
var accountProjectMemberIds = (state, account, currentMember) => {
  if (currentMember) return projectMemberIdentityIds(state, currentMember);
  if (!account) return projectMemberIdentityIds(state, resolveCurrentMember(state));
  return new Set(
    state.projectMembers.filter((member) => member.status !== "disabled" && projectMemberMatchesIdentity(member, accountIdentity(account))).map((member) => member.id)
  );
};
var accessibleProjectIdsForAccount = (state, account, currentMember) => {
  const memberIds = accountProjectMemberIds(state, account, currentMember);
  const workspaceIds = activeWorkspaceIdsForAccount(state, account);
  const projectIds = /* @__PURE__ */ new Set();
  state.projectMembers.filter((member) => member.status !== "disabled" && memberIds.has(member.id)).forEach((member) => projectIds.add(member.projectId));
  state.projects.filter((project) => {
    const workspaceId = workspaceIdForProject(state, project);
    return workspaceId ? workspaceIds.has(workspaceId) : false;
  }).forEach((project) => projectIds.add(project.id));
  return projectIds;
};
var accessibleProjectIdsForCurrentUser = (state, currentMember) => accessibleProjectIdsForAccount(state, state.auth.account, currentMember);

// src/projectDetailTaskCreation.ts
var estimateHoursToPomodoros = (estimateHours, focusMinutes = 25) => {
  const safeFocusMinutes = Math.max(1, Math.round(focusMinutes));
  const safeHours = Math.max(0, estimateHours ?? 1);
  return Math.max(1, Math.ceil(safeHours * 60 / safeFocusMinutes));
};
var createProjectTaskInState = (state, projectId, input, timestamp = nowIso(), idFactory = uid) => {
  const title = input.title.trim();
  const project = state.projects.find((item) => item.id === projectId);
  if (!title || !project) return state;
  const task = {
    id: idFactory("task"),
    workspaceId: project.workspaceId ?? state.auth.workspace?.id,
    title,
    notes: input.notes?.trim() ?? "",
    tags: input.tags ?? [],
    projectId: project.id,
    project: project.name,
    creatorMemberId: resolveMemberIdForProject(state, project.id),
    primaryExecutorMemberId: input.primaryExecutorMemberId || void 0,
    collaboratorMemberIds: input.collaboratorMemberIds?.filter((id) => id !== input.primaryExecutorMemberId) ?? [],
    expectedStartAt: input.expectedStartAt,
    expectedFinishAt: input.expectedFinishAt,
    priority: input.priority ?? "medium",
    severity: input.severity ?? "medium",
    stage: input.stage ?? defaultTaskStageForMode(project.taskStageMode ?? "software"),
    estimatePomodoros: input.estimateHours !== void 0 ? estimateHoursToPomodoros(input.estimateHours, state.settings.focusMinutes) : Math.max(1, Math.round(input.estimatePomodoros ?? 1)),
    status: "pool",
    ...emptyTaskDefaults(timestamp, Date.now()),
    dueAt: input.dueAt,
    reminderAt: input.reminderAt,
    repeatRule: input.repeatRule ?? "none",
    repeatIntervalDays: input.repeatIntervalDays,
    subtasks: (input.subtasks ?? []).map((title2) => title2.trim()).filter(Boolean).map((title2) => ({
      id: idFactory("subtask"),
      title: title2,
      completed: false,
      createdAt: timestamp
    }))
  };
  return {
    ...state,
    tasks: [task, ...state.tasks],
    updatedAt: timestamp
  };
};

// src/projectCreateState.ts
var nextProjectSortOrder = (projects) => {
  const orders = projects.map((project) => project.sortOrder).filter((value) => Number.isFinite(value));
  if (orders.length) return Math.max(...orders) + 1e3;
  return projects.length * 1e3;
};
function createProjectInState(state, name, description, timestamp = (/* @__PURE__ */ new Date()).toISOString(), idFactory = uid, owner) {
  const projectId = idFactory("project");
  const memberId = idFactory("member");
  const workspaceId = owner?.workspaceId ?? state.auth.workspace?.id ?? state.projects[0]?.workspaceId;
  const ownerName = owner?.name?.trim() || state.auth.account?.name || "\u9879\u76EE\u8D1F\u8D23\u4EBA";
  const ownerEmail = owner?.email?.trim() || state.auth.account?.email;
  return {
    ...state,
    projects: [
      {
        id: projectId,
        workspaceId,
        name: name.trim() || "\u65B0\u9879\u76EE",
        description: description.trim(),
        defaultExpectedStartHours: 24,
        taskStageMode: owner?.taskStageMode ?? "regular",
        sortOrder: nextProjectSortOrder(state.projects),
        createdAt: timestamp,
        updatedAt: timestamp
      },
      ...state.projects
    ],
    projectMembers: [
      {
        id: memberId,
        workspaceId,
        projectId,
        accountId: owner?.accountId ?? state.auth.account?.id,
        name: ownerName,
        email: ownerEmail,
        roles: ["project_owner", "executor"],
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      },
      ...state.projectMembers
    ],
    updatedAt: timestamp
  };
}

// src/projectUpdateState.ts
function updateProjectInState(state, project, timestamp = (/* @__PURE__ */ new Date()).toISOString(), _idFactory = uid) {
  const existingProject = state.projects.find((item) => item.id === project.id);
  const previousWorkspaceId = existingProject?.workspaceId ?? state.auth.workspace?.id;
  const nextWorkspaceId = project.workspaceId;
  const workspaceChanged = Boolean(existingProject && previousWorkspaceId !== nextWorkspaceId);
  const projectTaskIds = new Set(state.tasks.filter((task) => task.projectId === project.id).map((task) => task.id));
  return {
    ...state,
    projects: state.projects.map((item) => item.id === project.id ? { ...project, updatedAt: timestamp } : item),
    projectMembers: state.projectMembers.map(
      (member) => workspaceChanged && member.projectId === project.id ? {
        ...member,
        workspaceId: nextWorkspaceId,
        accountId: member.accountId,
        name: member.name,
        email: member.email,
        status: member.status ?? "active",
        updatedAt: timestamp
      } : member
    ),
    tasks: state.tasks.map(
      (task) => task.projectId === project.id ? {
        ...task,
        workspaceId: nextWorkspaceId,
        project: project.name,
        updatedAt: workspaceChanged || task.project !== project.name ? timestamp : task.updatedAt
      } : task
    ),
    workSessions: state.workSessions.map(
      (session) => workspaceChanged && projectTaskIds.has(session.taskId) ? { ...session, workspaceId: nextWorkspaceId, updatedAt: timestamp } : session
    ),
    executionSignals: state.executionSignals.map(
      (signal) => workspaceChanged && projectTaskIds.has(signal.taskId) ? { ...signal, workspaceId: nextWorkspaceId } : signal
    ),
    focusSessions: state.focusSessions.map(
      (session) => workspaceChanged && session.taskId && projectTaskIds.has(session.taskId) ? { ...session, workspaceId: nextWorkspaceId } : session
    ),
    interruptions: state.interruptions.map(
      (interruption) => workspaceChanged && interruption.taskId && projectTaskIds.has(interruption.taskId) ? { ...interruption, workspaceId: nextWorkspaceId } : interruption
    ),
    updatedAt: timestamp
  };
}

// src/taskAssignmentState.ts
function assignTaskInState(state, taskId, assignment, timestamp = (/* @__PURE__ */ new Date()).toISOString()) {
  const currentTask = state.tasks.find((task) => task.id === taskId);
  if (!currentTask) return state;
  const projectId = assignment.projectId ?? currentTask.projectId;
  const project = state.projects.find((item) => item.id === projectId) ?? state.projects[0];
  if (!project) return state;
  const projectMembers = projectMembersForProject(state, project.id);
  const executorIds = new Set(projectMembers.filter((member) => member.roles.includes("executor")).map((member) => member.id));
  const memberIds = new Set(projectMembers.map((member) => member.id));
  const primaryExecutorMemberId = assignment.primaryExecutorMemberId && executorIds.has(assignment.primaryExecutorMemberId) ? assignment.primaryExecutorMemberId : assignment.primaryExecutorMemberId === void 0 ? currentTask.primaryExecutorMemberId && executorIds.has(currentTask.primaryExecutorMemberId) ? currentTask.primaryExecutorMemberId : void 0 : void 0;
  const collaboratorMemberIds = Array.from(new Set(assignment.collaboratorMemberIds ?? currentTask.collaboratorMemberIds ?? [])).filter((memberId) => memberIds.has(memberId)).filter((memberId) => memberId !== primaryExecutorMemberId);
  return {
    ...state,
    tasks: state.tasks.map(
      (task) => task.id === taskId ? {
        ...task,
        workspaceId: project.workspaceId ?? task.workspaceId,
        projectId: project.id,
        project: project.name,
        primaryExecutorMemberId,
        collaboratorMemberIds,
        updatedAt: timestamp
      } : task
    ),
    updatedAt: timestamp
  };
}

// src/taskProgressUpdateState.ts
function updateTaskProgressInState(state, taskId, progressPercent, progressNote, timestamp = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    ...state,
    tasks: state.tasks.map(
      (task) => task.id === taskId ? {
        ...task,
        progressPercent: clampProgressPercent(progressPercent),
        progressNote,
        updatedAt: timestamp
      } : task
    ),
    updatedAt: timestamp
  };
}

// src/taskReviewState.ts
var actualPomodorosForTask = (state, task) => state.focusSessions.filter((session) => session.taskId === task.id && session.outcome === "completed").length || task.actualPomodoros || 0;
function submitTaskForReviewInState(state, taskId, submitterMemberId, timestamp = (/* @__PURE__ */ new Date()).toISOString()) {
  const canSubmitForReview = (task) => task.status === "committed" || task.status === "in_progress";
  const shouldEndActiveWork = state.tasks.some((task) => task.id === taskId && canSubmitForReview(task));
  const submitted = {
    ...state,
    tasks: state.tasks.map(
      (task) => task.id === taskId && canSubmitForReview(task) ? {
        ...task,
        status: "pending_review",
        progressPercent: 100,
        actualPomodoros: actualPomodorosForTask(state, task),
        reviewSubmittedAt: timestamp,
        reviewSubmittedByMemberId: submitterMemberId,
        reviewAcceptedAt: void 0,
        reviewAcceptedByMemberId: void 0,
        reviewReturnedAt: void 0,
        reviewReturnedByMemberId: void 0,
        reviewReturnReason: void 0,
        updatedAt: timestamp
      } : task
    ),
    updatedAt: timestamp
  };
  if (!shouldEndActiveWork) return submitted;
  return endActiveWorkSessionsForTaskInState(submitted, taskId, timestamp, {
    reason: "submitted_for_review",
    activeTimerWorkSessionId: state.activeTimer?.workSessionId,
    activeTimerTotalPausedSeconds: state.activeTimer?.totalPausedSeconds,
    clearActiveTimer: true
  });
}
function acceptTaskInState(state, taskId, accepterMemberId, timestamp = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    ...state,
    tasks: state.tasks.map((task) => {
      if (task.id !== taskId || task.status !== "pending_review") return task;
      const actualPomodoros = actualPomodorosForTask(state, task);
      return {
        ...task,
        status: "completed",
        progressPercent: 100,
        actualPomodoros,
        reviewAcceptedAt: timestamp,
        reviewAcceptedByMemberId: accepterMemberId,
        completedAt: timestamp,
        updatedAt: timestamp,
        estimateHistory: [
          ...task.estimateHistory ?? [],
          {
            id: uid("estimate"),
            estimatedPomodoros: task.estimatePomodoros,
            actualPomodoros,
            recordedAt: timestamp,
            source: "completion"
          }
        ]
      };
    }),
    updatedAt: timestamp
  };
}
function returnTaskForReviewInState(state, taskId, reason, reviewerMemberId, timestamp = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    ...state,
    tasks: state.tasks.map(
      (task) => task.id === taskId && task.status === "pending_review" ? {
        ...task,
        status: "in_progress",
        progressPercent: Math.min(task.progressPercent ?? 0, 99),
        reviewReturnedAt: timestamp,
        reviewReturnedByMemberId: reviewerMemberId,
        reviewReturnReason: reason.trim(),
        updatedAt: timestamp
      } : task
    ),
    updatedAt: timestamp
  };
}

// cli/src/businessGuards.ts
var requireProject = (state, projectId) => {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
};
var requireTask = (state, taskId) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return task;
};
var requireMember = (state, projectMemberId) => {
  const member = state.projectMembers.find((item) => item.id === projectMemberId);
  if (!member) throw new Error(`Project member not found: ${projectMemberId}`);
  return member;
};

// cli/src/businessTaskOperations.ts
var createTaskInTeamState = (state, input, timestamp) => {
  requireProject(state, input.projectId);
  return createProjectTaskInState(state, input.projectId, input, timestamp, uid);
};
var updateTaskInTeamState = (state, taskId, input, timestamp) => {
  requireTask(state, taskId);
  return updateTaskInState(state, taskId, (task) => ({
    ...task,
    title: input.title?.trim() || task.title,
    notes: input.notes === void 0 ? task.notes : input.notes.trim(),
    tags: input.tags ?? task.tags,
    priority: input.priority ?? task.priority,
    severity: input.severity ?? task.severity,
    stage: input.stage ?? task.stage,
    estimatePomodoros: input.estimateHours === void 0 ? Math.max(1, Math.round(input.estimatePomodoros ?? task.estimatePomodoros)) : Math.max(1, Math.ceil(Math.max(0, input.estimateHours) * 60 / Math.max(1, state.settings.focusMinutes))),
    expectedStartAt: input.expectedStartAt === void 0 ? task.expectedStartAt : input.expectedStartAt,
    expectedFinishAt: input.expectedFinishAt === void 0 ? task.expectedFinishAt : input.expectedFinishAt,
    dueAt: input.dueAt === void 0 ? task.dueAt : input.dueAt,
    reminderAt: input.reminderAt === void 0 ? task.reminderAt : input.reminderAt,
    repeatRule: input.repeatRule ?? task.repeatRule,
    repeatIntervalDays: input.repeatIntervalDays === void 0 ? task.repeatIntervalDays : input.repeatIntervalDays,
    subtasks: input.subtasks === void 0 ? task.subtasks : input.subtasks.map((title) => title.trim()).filter(Boolean).map((title) => ({ id: uid("subtask"), title, completed: false, createdAt: timestamp }))
  }), timestamp);
};
var deleteTaskInTeamState = (state, taskId, timestamp) => deleteTaskFromState(state, requireTask(state, taskId), timestamp).state;
var assignTaskInTeamState = (state, taskId, assignment, timestamp) => assignTaskInState(state, taskId, assignment, timestamp);
var setTaskStatusInTeamState = (state, taskId, status, timestamp) => updateTaskInState(state, taskId, (task) => ({
  ...task,
  status,
  completedAt: status === "completed" ? task.completedAt ?? timestamp : task.completedAt
}), timestamp);
var updateTaskProgressInTeamState = (state, taskId, progressPercent, progressNote, timestamp) => updateTaskProgressInState(state, taskId, progressPercent, progressNote, timestamp);
var splitTaskInTeamState = (state, taskId, childTitles, timestamp) => {
  const task = requireTask(state, taskId);
  const titles = childTitles.map((title) => title.trim()).filter(Boolean);
  if (titles.length < 2) throw new Error("split_task requires at least two child titles.");
  return splitTaskInState(state, task, titles, timestamp, () => uid("task")).state;
};
var addTaskToTodayInTeamState = (state, taskId, timestamp) => addTaskToTodayInState(state, taskId, timestamp);
var batchAddTasksToTodayInTeamState = (state, taskIds, timestamp) => taskIds.reduce((current, taskId) => addTaskToTodayInState(current, taskId, timestamp), state);
var removeTaskFromTodayInTeamState = (state, taskId, timestamp) => removeTaskFromTodayInState(state, taskId, timestamp);
var moveTodayTaskInTeamState = (state, taskId, direction, timestamp) => moveCommittedTaskInState(state, taskId, direction, timestamp);
var scheduleTaskForDateInState = (state, taskId, date, timestamp) => {
  const task = requireTask(state, taskId);
  if (date === today()) return addTaskToTodayInState(state, taskId, timestamp);
  const workspaceId = workspaceIdForTask(state, task) ?? currentDailyPlanWorkspaceId(state);
  const existing = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date);
  const plan = existing ?? {
    ...createDailyPlanForDate(state, date, timestamp, workspaceId),
    capacityPomodoros: state.rewardState.dailyGoal,
    recommendedCapacityPomodoros: state.rewardState.dailyGoal,
    suggestedCapacityPomodoros: state.rewardState.dailyGoal,
    overloadAcknowledged: false
  };
  const nextPlan = {
    ...plan,
    committedTaskIds: Array.from(/* @__PURE__ */ new Set([...plan.committedTaskIds, taskId])),
    updatedAt: timestamp
  };
  return {
    ...state,
    tasks: state.tasks.map((item) => item.id === taskId && item.status === "pool" ? { ...item, status: "committed", updatedAt: timestamp } : item),
    dailyPlans: existing ? state.dailyPlans.map((item) => item.id === nextPlan.id ? nextPlan : item) : [nextPlan, ...state.dailyPlans],
    updatedAt: timestamp
  };
};
var startTaskInTeamState = (state, taskId, timestamp) => startWorkSessionInState(state, taskId, timestamp, { source: "cli", idFactory: uid });
var pauseWorkSessionInTeamState = (state, input, timestamp) => pauseWorkSessionInState(state, timestamp, input.taskId, input.workSessionId, { source: "cli", idFactory: uid });
var resumeWorkSessionInTeamState = (state, input, timestamp) => resumeWorkSessionInState(state, timestamp, input.taskId, input.workSessionId, { source: "cli", idFactory: uid });
var finishWorkSessionInTeamState = (state, input, timestamp) => finishWorkSessionInState(state, timestamp, input.taskId, input.workSessionId, { outcome: input.outcome, source: "cli", idFactory: uid });

// cli/src/businessReviewSettingsOperations.ts
var submitTaskReviewInTeamState = (state, taskId, timestamp) => {
  const task = requireTask(state, taskId);
  return submitTaskForReviewInState(state, taskId, resolveMemberIdForProject(state, task.projectId), timestamp);
};
var acceptTaskReviewInTeamState = (state, taskId, timestamp) => {
  const task = requireTask(state, taskId);
  return acceptTaskInState(state, taskId, resolveMemberIdForProject(state, task.projectId), timestamp);
};
var returnTaskReviewInTeamState = (state, taskId, reason, timestamp) => {
  const task = requireTask(state, taskId);
  return returnTaskForReviewInState(state, taskId, reason, resolveMemberIdForProject(state, task.projectId), timestamp);
};
var recordInterruptionInTeamState = (state, input, timestamp) => {
  const session = input.workSessionId ? state.workSessions.find((item) => item.id === input.workSessionId) : void 0;
  const taskId = input.taskId ?? session?.taskId;
  const task = taskId ? state.tasks.find((item) => item.id === taskId) : void 0;
  return {
    ...state,
    interruptions: [
      {
        id: uid("interruption"),
        workspaceId: task ? workspaceIdForTask(state, task) : state.auth.workspace?.id,
        sessionId: input.workSessionId,
        taskId,
        type: input.type,
        note: input.note?.trim() ?? "",
        action: input.action ?? "defer",
        createdAt: timestamp
      },
      ...state.interruptions
    ],
    updatedAt: timestamp
  };
};
var updateDailyReviewInTeamState = (state, input, timestamp) => {
  const date = input.date ?? today();
  const workspaceId = input.workspaceId ?? currentDailyPlanWorkspaceId(state);
  const existing = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date);
  const plan = existing ?? createDailyPlanForDate(state, date, timestamp, workspaceId);
  const nextPlan = {
    ...plan,
    reflection: input.reflection ?? plan.reflection,
    capacityPomodoros: input.capacityPomodoros === void 0 ? plan.capacityPomodoros : Math.max(1, Math.round(input.capacityPomodoros)),
    review: {
      ...plan.review,
      mood: input.mood ?? plan.review.mood,
      wins: input.wins ?? plan.review.wins,
      blockers: input.blockers ?? plan.review.blockers,
      interruptionPattern: input.interruptionPattern ?? plan.review.interruptionPattern,
      tomorrowFocus: input.tomorrowFocus ?? plan.review.tomorrowFocus
    },
    reviewedAt: timestamp,
    updatedAt: timestamp
  };
  return {
    ...state,
    dailyPlans: existing ? state.dailyPlans.map((item) => item.id === nextPlan.id ? nextPlan : item) : [nextPlan, ...state.dailyPlans],
    updatedAt: timestamp
  };
};
var updateSettingsInTeamState = (state, input, timestamp) => ({
  ...state,
  settings: {
    ...state.settings,
    ...input,
    focusMinutes: input.focusMinutes === void 0 ? state.settings.focusMinutes : Math.max(1, Math.round(input.focusMinutes)),
    shortBreakMinutes: input.shortBreakMinutes === void 0 ? state.settings.shortBreakMinutes : Math.max(1, Math.round(input.shortBreakMinutes)),
    longBreakMinutes: input.longBreakMinutes === void 0 ? state.settings.longBreakMinutes : Math.max(1, Math.round(input.longBreakMinutes)),
    longBreakEvery: input.longBreakEvery === void 0 ? state.settings.longBreakEvery : Math.max(1, Math.round(input.longBreakEvery)),
    whiteNoiseVolume: input.whiteNoiseVolume === void 0 ? state.settings.whiteNoiseVolume : Math.min(100, Math.max(0, Math.round(input.whiteNoiseVolume)))
  },
  updatedAt: timestamp
});
var saveTaskTemplateInTeamState = (state, input, timestamp) => {
  const template = {
    id: input.id?.trim() || uid("template"),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    project: input.project?.trim() ?? "",
    tags: input.tags ?? [],
    priority: input.priority,
    severity: input.severity,
    stage: input.stage,
    estimatePomodoros: Math.max(1, Math.round(input.estimatePomodoros)),
    subtasks: input.subtasks ?? [],
    repeatRule: input.repeatRule
  };
  return {
    ...state,
    taskTemplates: state.taskTemplates.some((item) => item.id === template.id) ? state.taskTemplates.map((item) => item.id === template.id ? template : item) : [template, ...state.taskTemplates],
    updatedAt: timestamp
  };
};
var deleteTaskTemplateInTeamState = (state, templateId, timestamp) => ({
  ...state,
  taskTemplates: state.taskTemplates.filter((item) => item.id !== templateId),
  templateInstances: state.templateInstances.filter((item) => item.templateId !== templateId),
  updatedAt: timestamp
});
var instantiateTaskTemplateInTeamState = (state, templateId, projectId, timestamp) => {
  const template = state.taskTemplates.find((item) => item.id === templateId);
  if (!template) throw new Error(`Task template not found: ${templateId}`);
  const beforeTaskIds = new Set(state.tasks.map((task2) => task2.id));
  const next = createProjectTaskInState(state, projectId, {
    title: template.name,
    notes: template.description,
    tags: template.tags,
    priority: template.priority,
    severity: template.severity,
    stage: template.stage,
    estimatePomodoros: template.estimatePomodoros,
    repeatRule: template.repeatRule,
    subtasks: template.subtasks
  }, timestamp, uid);
  const task = next.tasks.find((item) => !beforeTaskIds.has(item.id));
  if (!task) throw new Error("Task template was not instantiated.");
  return {
    ...next,
    templateInstances: [{ templateId, taskId: task.id, createdAt: timestamp }, ...next.templateInstances],
    updatedAt: timestamp
  };
};

// cli/src/businessProjectMemberOperations.ts
var createProjectInTeamState = (state, input, timestamp) => {
  const next = createProjectInState(state, input.name, input.description ?? "", timestamp, uid, {
    accountId: state.auth.account?.id,
    name: state.auth.account?.name,
    email: state.auth.account?.email,
    workspaceId: input.workspaceId,
    taskStageMode: input.taskStageMode
  });
  const created = next.projects.find((project2) => !state.projects.some((item) => item.id === project2.id));
  if (!created) throw new Error("Project was not created.");
  const project = {
    ...created,
    defaultExpectedStartHours: input.defaultExpectedStartHours === void 0 ? created.defaultExpectedStartHours : Math.max(0, Math.round(input.defaultExpectedStartHours))
  };
  return updateProjectInState(next, project, timestamp);
};
var updateProjectInTeamState = (state, projectId, input, timestamp) => {
  const project = requireProject(state, projectId);
  return updateProjectInState(state, {
    ...project,
    name: input.name?.trim() || project.name,
    description: input.description ?? project.description,
    defaultExpectedStartHours: input.defaultExpectedStartHours === void 0 ? project.defaultExpectedStartHours : Math.max(0, Math.round(input.defaultExpectedStartHours)),
    taskStageMode: input.taskStageMode ?? project.taskStageMode
  }, timestamp);
};
var archiveProjectInTeamState = (state, projectId, timestamp) => {
  const project = requireProject(state, projectId);
  return updateProjectInState(state, { ...project, archivedAt: timestamp }, timestamp);
};
var restoreProjectInTeamState = (state, projectId, timestamp) => {
  const project = requireProject(state, projectId);
  return updateProjectInState(state, { ...project, archivedAt: void 0 }, timestamp);
};
var createProjectMemberInTeamState = (state, input, timestamp) => {
  const project = requireProject(state, input.projectId);
  return addProjectMemberToState(
    state,
    project.id,
    input.name,
    input.email ?? "",
    input.roles ?? ["executor"],
    timestamp,
    uid,
    { accountId: input.accountId, workspaceId: project.workspaceId }
  );
};
var updateProjectMemberInTeamState = (state, projectMemberId, input, timestamp) => {
  const member = requireMember(state, projectMemberId);
  return updateProjectMemberInState(state, {
    ...member,
    name: input.name?.trim() || member.name,
    email: input.email === void 0 ? member.email : input.email.trim() || void 0,
    roles: input.roles ?? member.roles,
    status: input.status ?? member.status ?? "active"
  }, timestamp);
};
var bindMemberToProjectInTeamState = (state, projectId, memberRef, roles, timestamp) => {
  const project = requireProject(state, projectId);
  const normalized = memberRef.trim().toLowerCase();
  const source = state.projectMembers.find(
    (member) => member.id === memberRef || member.accountId === memberRef || member.email?.trim().toLowerCase() === normalized
  );
  if (!source) throw new Error(`Project member source not found: ${memberRef}`);
  return addProjectMemberToState(state, project.id, source.name, source.email ?? "", roles.length ? roles : ["executor"], timestamp, uid, {
    accountId: source.accountId,
    workspaceId: project.workspaceId ?? source.workspaceId
  });
};
var unbindProjectMemberInTeamState = (state, projectMemberId, timestamp) => updateProjectMemberInTeamState(state, projectMemberId, { status: "disabled" }, timestamp);

// src/authModel.ts
var bindAccountToMembers = (value, auth, timestamp = (/* @__PURE__ */ new Date()).toISOString()) => {
  const account = auth.account;
  if (!account) return value;
  const hasAccountOwnerForProject = (projectId) => value.projectMembers.some((member) => member.projectId === projectId && member.accountId === account.id && member.roles.includes("project_owner"));
  const memberHasIdentity = (member) => {
    return Boolean(member.accountId || member.email);
  };
  const projectHasIdentifiedMember = (projectId) => value.projectMembers.some((member) => member.projectId === projectId && memberHasIdentity(member));
  const accountEmail = account.email.toLowerCase();
  const shouldBindProjectMember = (member) => {
    if (member.accountId === account.id) return true;
    if (member.accountId) return false;
    if (member.email?.toLowerCase() === accountEmail) return true;
    return member.roles.includes("project_owner") && !hasAccountOwnerForProject(member.projectId) && !projectHasIdentifiedMember(member.projectId) && !member.email;
  };
  const projectMembers = value.projectMembers.map(
    (member) => shouldBindProjectMember(member) ? {
      ...member,
      accountId: account.id,
      name: member.name || account.name,
      email: member.email ?? account.email,
      status: member.status ?? "active",
      updatedAt: timestamp
    } : { ...member, status: member.status ?? "active" }
  );
  return {
    ...value,
    auth,
    projectMembers,
    backend: {
      ...value.backend,
      token: auth.token,
      username: account.email,
      message: auth.message,
      status: "idle"
    },
    updatedAt: timestamp
  };
};

// src/teamBackendHttp.ts
var apiUrl = (serverUrl, path) => `${serverUrl.replace(/\/+$/, "")}${path}`;
var authHeaders = (token) => ({
  "Content-Type": "application/json",
  ...token ? { Authorization: `Bearer ${token}` } : {}
});
var REQUEST_TIMEOUT_MS = 8e3;
var readResponse = async (response) => {
  if (response.ok) return response.json();
  let message = `${response.status} ${response.statusText}`;
  try {
    const body = await response.json();
    if (body.error) message = body.error;
  } catch {
    const text = await response.text().catch(() => "");
    if (text) message = text;
  }
  throw new Error(message);
};
var requestJson = async (input, init) => {
  const timeoutController = init?.signal ? void 0 : new AbortController();
  let timeoutId;
  try {
    if (timeoutController) {
      timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
    }
    const response = await fetch(input, timeoutController ? { ...init, signal: timeoutController.signal } : init);
    return readResponse(response);
  } catch (error) {
    if (error instanceof TypeError || error instanceof DOMException && error.name === "AbortError") {
      throw new Error("\u65E0\u6CD5\u8FDE\u63A5\u56E2\u961F\u540E\u53F0\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5730\u5740\u662F\u5426\u6B63\u786E\uFF0C\u5E76\u786E\u8BA4\u540E\u53F0\u670D\u52A1\u5DF2\u542F\u52A8");
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

// src/teamBackendMappers.ts
var mapAccount = (account) => ({
  id: account.id,
  workspaceId: account.workspace_id,
  name: account.name,
  email: account.email,
  disabledAt: account.disabled_at || void 0,
  createdAt: account.created_at,
  updatedAt: account.updated_at
});
var mapWorkspace = (workspace) => ({
  id: workspace.id,
  name: workspace.name,
  type: workspace.type === "private" ? "private" : "shared",
  ownerAccountId: workspace.owner_account_id || void 0,
  createdAt: workspace.created_at,
  updatedAt: workspace.updated_at
});
var mapWorkspaceMembership = (membership) => ({
  id: membership.id,
  workspaceId: membership.workspace_id,
  accountId: membership.account_id,
  name: membership.name,
  email: membership.email,
  role: membership.role,
  status: membership.status,
  createdAt: membership.created_at,
  updatedAt: membership.updated_at
});
var mapWorkspaceInvitation = (invitation) => ({
  id: invitation.id,
  workspaceId: invitation.workspace_id,
  workspaceName: invitation.workspace_name,
  workspaceType: invitation.workspace_type === "private" ? "private" : "shared",
  inviterAccountId: invitation.inviter_account_id,
  inviterName: invitation.inviter_name,
  inviterEmail: invitation.inviter_email,
  inviteeAccountId: invitation.invitee_account_id,
  inviteeEmail: invitation.invitee_email,
  status: invitation.status,
  createdAt: invitation.created_at,
  updatedAt: invitation.updated_at,
  acceptedAt: invitation.accepted_at || void 0
});
var mapProjectInvitation = (invitation) => ({
  id: invitation.id,
  workspaceId: invitation.workspace_id,
  workspaceName: invitation.workspace_name,
  projectId: invitation.project_id,
  projectName: invitation.project_name,
  inviterAccountId: invitation.inviter_account_id,
  inviterName: invitation.inviter_name,
  inviterEmail: invitation.inviter_email,
  inviteeAccountId: invitation.invitee_account_id,
  inviteeEmail: invitation.invitee_email,
  roles: invitation.roles?.length ? invitation.roles : ["executor"],
  status: invitation.status,
  createdAt: invitation.created_at,
  updatedAt: invitation.updated_at,
  acceptedAt: invitation.accepted_at || void 0
});
var sessionFromLogin = (payload) => ({
  token: payload.token,
  expiresAt: payload.expires_at,
  account: mapAccount(payload.account),
  workspace: mapWorkspace(payload.workspace),
  membership: payload.membership ? mapWorkspaceMembership(payload.membership) : void 0,
  workspaces: (payload.workspaces ?? [payload.workspace]).map(mapWorkspace)
});

// src/teamBackendAuthApi.ts
async function getAuthStatus(serverUrl) {
  return requestJson(apiUrl(serverUrl, "/auth/status"));
}
async function loginToWorkspace(backend, email, password) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/auth/login"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: email.trim(),
      password,
      device_id: backend.deviceId
    })
  });
  return sessionFromLogin(payload);
}
async function switchWorkspace(backend, token, workspaceId) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/auth/switch-workspace"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: workspaceId,
      device_id: backend.deviceId
    })
  });
  return sessionFromLogin(payload);
}

// src/teamBackendWorkspaceApi.ts
async function createWorkspace(backend, token, name) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/workspaces"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name,
      type: "shared",
      device_id: backend.deviceId
    })
  });
  return sessionFromLogin(payload);
}
async function fetchWorkspaces(backend, token) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/workspaces"), {
    headers: authHeaders(token)
  });
  return {
    workspaces: payload.workspaces.map(mapWorkspace),
    memberships: (payload.memberships ?? []).map(mapWorkspaceMembership)
  };
}
async function updateWorkspace(backend, token, workspaceId, input) {
  const payload = await requestJson(apiUrl(backend.serverUrl, `/workspaces/${encodeURIComponent(workspaceId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: input.name,
      type: input.type ?? "shared",
      owner_account_id: input.ownerAccountId
    })
  });
  return mapWorkspace(payload.workspace);
}
async function updateWorkspaceMembership(backend, token, workspaceId, membershipId, input) {
  const payload = await requestJson(
    apiUrl(backend.serverUrl, `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(membershipId)}`),
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({
        status: input.status,
        role: input.role
      })
    }
  );
  return mapWorkspaceMembership(payload.membership);
}

// src/teamBackendInvitationApi.ts
async function fetchWorkspaceInvitations(backend, token) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/workspace-invitations"), {
    headers: authHeaders(token)
  });
  return payload.invitations.map(mapWorkspaceInvitation);
}
async function inviteWorkspaceMember(backend, token, workspaceId, email) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/workspace-invitations"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: workspaceId,
      email
    })
  });
  return mapWorkspaceInvitation(payload.invitation);
}
async function acceptWorkspaceInvitation(backend, token, invitationId) {
  const payload = await requestJson(
    apiUrl(backend.serverUrl, `/workspace-invitations/${encodeURIComponent(invitationId)}/accept`),
    {
      method: "POST",
      headers: authHeaders(token)
    }
  );
  return mapWorkspaceInvitation(payload.invitation);
}
async function deleteWorkspaceInvitation(backend, token, invitationId) {
  const payload = await requestJson(
    apiUrl(backend.serverUrl, `/workspace-invitations/${encodeURIComponent(invitationId)}`),
    {
      method: "DELETE",
      headers: authHeaders(token)
    }
  );
  return mapWorkspaceInvitation(payload.invitation);
}
async function fetchProjectInvitations(backend, token) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/project-invitations"), {
    headers: authHeaders(token)
  });
  return payload.invitations.map(mapProjectInvitation);
}
async function inviteProjectMember(backend, token, input) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/project-invitations"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      email: input.email,
      roles: input.roles.length ? input.roles : ["executor"]
    })
  });
  return mapProjectInvitation(payload.invitation);
}
async function deleteProjectInvitation(backend, token, invitationId) {
  const payload = await requestJson(
    apiUrl(backend.serverUrl, `/project-invitations/${encodeURIComponent(invitationId)}`),
    {
      method: "DELETE",
      headers: authHeaders(token)
    }
  );
  return mapProjectInvitation(payload.invitation);
}
async function acceptProjectInvitation(backend, token, invitationId) {
  const payload = await requestJson(
    apiUrl(backend.serverUrl, `/project-invitations/${encodeURIComponent(invitationId)}/accept`),
    {
      method: "POST",
      headers: authHeaders(token)
    }
  );
  return mapProjectInvitation(payload.invitation);
}

// src/teamBackendAdminApi.ts
async function fetchPlatformAccounts(backend, token) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/admin/accounts"), {
    headers: authHeaders(token)
  });
  return payload.accounts.map(mapAccount);
}
async function createPlatformAccount(backend, token, payload) {
  const result = await requestJson(apiUrl(backend.serverUrl, "/admin/accounts"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      status: payload.status
    })
  });
  return mapAccount(result.account);
}
async function updatePlatformAccount(backend, token, accountId, payload) {
  const result = await requestJson(apiUrl(backend.serverUrl, `/admin/accounts/${encodeURIComponent(accountId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      status: payload.status
    })
  });
  return mapAccount(result.account);
}
async function createMemberAccount(backend, token, payload) {
  const result = await requestJson(apiUrl(backend.serverUrl, "/members"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      project_id: payload.projectId,
      workspace_id: payload.workspaceId,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      roles: payload.roles
    })
  });
  return result.member.payload;
}
async function updateMemberAccount(backend, token, memberId, payload) {
  const result = await requestJson(apiUrl(backend.serverUrl, `/members/${encodeURIComponent(memberId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      workspace_id: payload.workspaceId,
      email: payload.email,
      password: payload.password,
      roles: payload.roles
    })
  });
  return result.member.payload;
}

// src/projectMemberDeduplication.ts
var projectMemberIdentityScope = (member) => `${member.workspaceId ?? ""}:${member.projectId}`;
var compareProjectMemberFreshness = (left, right) => (left.updatedAt ?? "").localeCompare(right.updatedAt ?? "");
var dedupeProjectMembersByIdentity = (members) => {
  const canonicalByIdentity = /* @__PURE__ */ new Map();
  const aliasToIdentity = /* @__PURE__ */ new Map();
  for (const member of members) {
    const scope = projectMemberIdentityScope(member);
    const identity = memberIdentityForProjectMember(member);
    const aliases = memberAccessIdentityAliases(identity).map((alias) => `${scope}:${alias}`);
    const existingIdentity = aliases.map((alias) => aliasToIdentity.get(alias)).find((key) => Boolean(key && canonicalByIdentity.has(key)));
    const identityKey = existingIdentity ?? `${scope}:${memberAccessIdentityKey(identity)}`;
    aliases.forEach((alias) => aliasToIdentity.set(alias, identityKey));
    const current = canonicalByIdentity.get(identityKey);
    if (!current || compareProjectMemberFreshness(member, current) > 0) {
      canonicalByIdentity.set(identityKey, member);
    }
  }
  const canonicalIds = new Set(Array.from(canonicalByIdentity.values()).map((member) => member.id));
  return members.filter((member) => canonicalIds.has(member.id));
};

// src/businessStateWorkspace.ts
var isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function buildTeamDataWorkspace(state) {
  const currentWorkspaceId = state.auth.workspace?.id;
  const projectWorkspaceIds = new Map(state.projects.map((project) => [project.id, project.workspaceId ?? currentWorkspaceId]));
  const taskWorkspaceIds = new Map(
    state.tasks.map((task) => [task.id, task.workspaceId ?? projectWorkspaceIds.get(task.projectId) ?? currentWorkspaceId])
  );
  const workspaceIdForPayload = (payload, fallback) => {
    if (isObject(payload) && typeof payload.workspaceId === "string" && payload.workspaceId.trim()) {
      return payload.workspaceId;
    }
    return fallback;
  };
  return {
    currentWorkspaceId,
    projectWorkspaceId: (projectId) => projectWorkspaceIds.get(projectId),
    taskWorkspaceId: (taskId) => taskWorkspaceIds.get(taskId),
    workspaceIdForPayload
  };
}

// src/teamBusinessRows.ts
var templateInstanceId = (instance) => `${instance.templateId}_${instance.taskId}`;
var rewardStateId = (state) => `reward_state_${state.auth.account?.id ?? "local"}`;
function businessRowsFromState(state) {
  const workspace = buildTeamDataWorkspace(state);
  const currentWorkspaceId = workspace.currentWorkspaceId;
  const ownerAccountId = state.auth.account?.id;
  return [
    ...state.projects.map((project) => ({
      workspace_id: workspace.workspaceIdForPayload(project, currentWorkspaceId),
      entity: "project",
      id: project.id,
      updated_at: project.updatedAt,
      payload: project
    })),
    ...state.projectMembers.map((member) => ({
      workspace_id: workspace.workspaceIdForPayload(member, workspace.projectWorkspaceId(member.projectId) ?? currentWorkspaceId),
      entity: "project_member",
      id: member.id,
      updated_at: member.updatedAt,
      payload: member
    })),
    ...state.tasks.map((task) => {
      const workspaceId = workspace.projectWorkspaceId(task.projectId) ?? workspace.workspaceIdForPayload(task, currentWorkspaceId);
      return {
        workspace_id: workspaceId,
        entity: "task",
        id: task.id,
        updated_at: task.updatedAt,
        payload: workspaceId && task.workspaceId !== workspaceId ? { ...task, workspaceId } : task
      };
    }),
    ...state.dailyPlans.map((plan) => {
      const workspaceId = workspace.workspaceIdForPayload(plan, currentWorkspaceId);
      return {
        workspace_id: workspaceId,
        account_id: plan.ownerAccountId ?? ownerAccountId,
        entity: "daily_plan",
        id: plan.id,
        updated_at: plan.updatedAt,
        payload: workspaceId && plan.workspaceId !== workspaceId ? { ...plan, workspaceId } : plan
      };
    }),
    ...state.focusSessions.map((session) => ({
      workspace_id: workspace.workspaceIdForPayload(
        session,
        session.taskId ? workspace.taskWorkspaceId(session.taskId) : currentWorkspaceId
      ),
      entity: "focus_session",
      id: session.id,
      updated_at: session.endedAt ?? session.startedAt,
      payload: session
    })),
    ...state.workSessions.map((session) => ({
      workspace_id: workspace.workspaceIdForPayload(session, workspace.taskWorkspaceId(session.taskId) ?? currentWorkspaceId),
      entity: "work_session",
      id: session.id,
      updated_at: session.updatedAt,
      payload: session
    })),
    ...state.executionSignals.map((signal) => ({
      workspace_id: workspace.workspaceIdForPayload(signal, workspace.taskWorkspaceId(signal.taskId) ?? currentWorkspaceId),
      entity: "execution_signal",
      id: signal.id,
      updated_at: signal.createdAt,
      payload: signal
    })),
    ...state.interruptions.map((interruption) => ({
      workspace_id: workspace.workspaceIdForPayload(
        interruption,
        interruption.taskId ? workspace.taskWorkspaceId(interruption.taskId) : currentWorkspaceId
      ),
      entity: "interruption",
      id: interruption.id,
      updated_at: interruption.resolvedAt ?? interruption.createdAt,
      payload: interruption
    })),
    {
      workspace_id: currentWorkspaceId,
      account_id: ownerAccountId,
      entity: "reward_state",
      id: rewardStateId(state),
      updated_at: state.updatedAt,
      payload: state.rewardState
    },
    ...state.taskTemplates.map((template) => ({
      workspace_id: currentWorkspaceId,
      entity: "task_template",
      id: template.id,
      updated_at: state.updatedAt,
      payload: template
    })),
    ...state.templateInstances.map((instance) => ({
      workspace_id: currentWorkspaceId,
      entity: "template_instance",
      id: templateInstanceId(instance),
      updated_at: instance.createdAt,
      payload: instance
    }))
  ];
}
function mergeBusinessRowsIntoState(local, rows) {
  const loadedAt = (/* @__PURE__ */ new Date()).toISOString();
  const base = createInitialState();
  const next = {
    ...base,
    auth: local.auth,
    settings: local.settings,
    backend: {
      ...local.backend,
      status: "ready",
      message: "\u56E2\u961F\u5728\u7EBF\u6570\u636E\u5DF2\u52A0\u8F7D",
      lastLoadedAt: loadedAt
    },
    projects: [],
    projectMembers: [],
    tasks: [],
    dailyPlans: [],
    focusSessions: [],
    workSessions: [],
    executionSignals: [],
    interruptions: [],
    taskTemplates: [],
    templateInstances: [],
    rewardState: local.rewardState,
    updatedAt: loadedAt
  };
  for (const row of rows) {
    if (row.entity === "project") next.projects.push(row.payload);
    if (row.entity === "project_member") next.projectMembers.push(row.payload);
    if (row.entity === "task") next.tasks.push(row.payload);
    if (row.entity === "daily_plan") next.dailyPlans.push(row.payload);
    if (row.entity === "focus_session") next.focusSessions.push(row.payload);
    if (row.entity === "work_session") next.workSessions.push(row.payload);
    if (row.entity === "execution_signal") next.executionSignals.push(row.payload);
    if (row.entity === "interruption") next.interruptions.push(row.payload);
    if (row.entity === "task_template") next.taskTemplates.push(row.payload);
    if (row.entity === "template_instance") next.templateInstances.push(row.payload);
    if (row.entity === "reward_state" && (!row.account_id || row.account_id === local.auth.account?.id)) {
      next.rewardState = row.payload;
    }
  }
  return {
    ...next,
    projectMembers: dedupeProjectMembersByIdentity(next.projectMembers)
  };
}

// src/teamActiveRuntimePreservation.ts
var upsertById = (items, incoming) => items.some((item) => item.id === incoming.id) ? items.map((item) => item.id === incoming.id ? incoming : item) : [incoming, ...items];
var localIsNewerOrMissing = (local, remote) => !remote || (local.updatedAt ?? local.startedAt ?? "") >= (remote.updatedAt ?? remote.startedAt ?? "");
var preserveLocalActiveRuntime = (remote, local) => {
  const active = local.activeTimer;
  if (!active) return remote;
  let next = { ...remote, activeTimer: active };
  const localTask = active.taskId ? local.tasks.find((task) => task.id === active.taskId) : void 0;
  if (localTask && localIsNewerOrMissing(localTask, next.tasks.find((task) => task.id === localTask.id))) {
    next = { ...next, tasks: upsertById(next.tasks, localTask) };
  }
  const localFocusSession = local.focusSessions.find((session) => session.id === active.sessionId);
  if (localFocusSession && localIsNewerOrMissing(localFocusSession, next.focusSessions.find((session) => session.id === localFocusSession.id))) {
    next = { ...next, focusSessions: upsertById(next.focusSessions, localFocusSession) };
  }
  const localWorkSession = local.workSessions.find(
    (session) => active.workSessionId ? session.id === active.workSessionId : session.focusSessionId === active.sessionId
  );
  if (localWorkSession && (localWorkSession.status === "active" || localWorkSession.status === "paused") && localIsNewerOrMissing(localWorkSession, next.workSessions.find((session) => session.id === localWorkSession.id))) {
    next = { ...next, workSessions: upsertById(next.workSessions, localWorkSession) };
  }
  const localSignals = localWorkSession ? local.executionSignals.filter((signal) => signal.workSessionId === localWorkSession.id) : [];
  if (localSignals.length) {
    const existingSignalIds = new Set(next.executionSignals.map((signal) => signal.id));
    const missingSignals = localSignals.filter((signal) => !existingSignalIds.has(signal.id));
    if (missingSignals.length) {
      next = { ...next, executionSignals: [...missingSignals, ...next.executionSignals] };
    }
  }
  return ensureTodayPlan(next);
};

// src/teamBusinessApi.ts
async function loadTeamData(local) {
  const token = local.auth.token ?? local.backend.token;
  if (!token) return local;
  const payload = await requestJson(apiUrl(local.backend.serverUrl, "/team/data"), {
    headers: authHeaders(token)
  });
  return preserveLocalActiveRuntime(mergeBusinessRowsIntoState(local, payload.rows), local);
}
async function saveTeamDataSnapshot(backend, token, state) {
  const savedAt = (/* @__PURE__ */ new Date()).toISOString();
  const payload = await requestJson(apiUrl(backend.serverUrl, "/team/data"), {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ rows: businessRowsFromState(state) })
  });
  return preserveLocalActiveRuntime(mergeBusinessRowsIntoState({
    ...state,
    backend: {
      ...state.backend,
      lastSavedAt: savedAt
    }
  }, payload.rows), state);
}

// cli/src/clientBase.ts
var TimeManageBaseClient = class {
  constructor(config) {
    this.config = config;
  }
  session;
  backendState(session) {
    const state = createInitialState();
    return {
      ...state,
      auth: session ? {
        status: "authenticated",
        token: session.token,
        expiresAt: session.expiresAt,
        account: session.account,
        workspace: session.workspace,
        membership: session.membership,
        workspaces: session.workspaces,
        workspaceMemberships: [],
        bootstrapped: true,
        message: "CLI \u5DF2\u767B\u5F55\u56E2\u961F\u540E\u53F0"
      } : state.auth,
      backend: {
        ...state.backend,
        serverUrl: this.config.serverUrl,
        username: session?.account.email ?? this.config.email,
        deviceId: this.config.deviceId,
        token: session?.token,
        status: session ? "ready" : "idle",
        message: session ? "CLI \u5DF2\u8FDE\u63A5\u56E2\u961F\u540E\u53F0" : "CLI \u5C1A\u672A\u767B\u5F55\u56E2\u961F\u540E\u53F0"
      }
    };
  }
  async ensureSession() {
    if (this.session && new Date(this.session.expiresAt).getTime() > Date.now() + 6e4) return this.session;
    this.session = await loginToWorkspace(this.backendState().backend, this.config.email, this.config.password);
    return this.session;
  }
  async authenticatedState() {
    const session = await this.ensureSession();
    const base = this.backendState(session);
    const workspaces = await fetchWorkspaces(base.backend, session.token);
    const auth = {
      ...base.auth,
      status: "authenticated",
      token: session.token,
      expiresAt: session.expiresAt,
      account: session.account,
      workspace: session.workspace,
      membership: session.membership,
      workspaces: workspaces.workspaces,
      workspaceMemberships: workspaces.memberships,
      bootstrapped: true,
      message: "CLI \u5DF2\u767B\u5F55\u56E2\u961F\u540E\u53F0"
    };
    const local = bindAccountToMembers({ ...base, auth }, auth);
    return bindAccountToMembers(await loadTeamData(local), auth);
  }
  async writeState(nextState) {
    const session = await this.ensureSession();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const stateToSave = {
      ...nextState,
      auth: {
        ...nextState.auth,
        status: "authenticated",
        token: session.token,
        expiresAt: session.expiresAt,
        account: session.account,
        workspace: session.workspace,
        membership: session.membership
      },
      backend: {
        ...nextState.backend,
        serverUrl: this.config.serverUrl,
        username: session.account.email,
        deviceId: this.config.deviceId,
        token: session.token,
        lastSavedAt: timestamp,
        status: "ready",
        message: "CLI \u5DF2\u5199\u5165\u56E2\u961F\u540E\u53F0"
      },
      updatedAt: timestamp
    };
    return saveTeamDataSnapshot(stateToSave.backend, session.token, stateToSave);
  }
  async mutate(_preferredProjectId, fn) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const before = await this.authenticatedState();
    const output = fn(before, timestamp);
    const saved = await this.writeState(output.state);
    return { state: saved, result: output.result, savedAt: saved.backend.lastSavedAt };
  }
  async backendAndToken() {
    const session = await this.ensureSession();
    return { backend: this.backendState(session).backend, token: session.token, session };
  }
  setSession(session) {
    this.session = session;
  }
  async health() {
    const status = await getAuthStatus(this.config.serverUrl);
    return {
      ok: true,
      serverUrl: this.config.serverUrl,
      bootstrapped: status.bootstrapped,
      workspaceId: status.workspace_id,
      workspaceName: status.workspace_name
    };
  }
  async getBackendDiagnostics() {
    const session = await this.ensureSession();
    const state = await this.authenticatedState();
    return {
      serverUrl: this.config.serverUrl,
      deviceId: this.config.deviceId,
      account: {
        id: session.account.id,
        email: session.account.email,
        name: session.account.name
      },
      workspace: state.auth.workspace,
      counts: {
        workspaces: state.auth.workspaces?.length ?? 0,
        workspaceMemberships: state.auth.workspaceMemberships?.length ?? 0,
        projects: state.projects.length,
        projectMembers: state.projectMembers.length,
        tasks: state.tasks.length,
        dailyPlans: state.dailyPlans.length,
        workSessions: state.workSessions.length,
        executionSignals: state.executionSignals.length,
        interruptions: state.interruptions.length,
        taskTemplates: state.taskTemplates.length
      },
      backend: {
        lastLoadedAt: state.backend.lastLoadedAt,
        lastSavedAt: state.backend.lastSavedAt,
        status: state.backend.status,
        message: state.backend.message
      }
    };
  }
  async getCurrentAccount() {
    const state = await this.authenticatedState();
    return {
      account: state.auth.account,
      workspace: state.auth.workspace,
      membership: state.auth.membership
    };
  }
  async listWorkspaces() {
    const { backend, token } = await this.backendAndToken();
    return fetchWorkspaces(backend, token);
  }
  async switchWorkspace(workspaceId) {
    const { backend, token } = await this.backendAndToken();
    this.setSession(await switchWorkspace(backend, token, workspaceId));
    return this.getCurrentAccount();
  }
  async createWorkspace(name) {
    const { backend, token } = await this.backendAndToken();
    this.setSession(await createWorkspace(backend, token, name));
    return this.getCurrentAccount();
  }
  async updateWorkspace(workspaceId, input) {
    const { backend, token } = await this.backendAndToken();
    return updateWorkspace(backend, token, workspaceId, input);
  }
  async updateWorkspaceMembership(workspaceId, membershipId, input) {
    const { backend, token } = await this.backendAndToken();
    return updateWorkspaceMembership(backend, token, workspaceId, membershipId, input);
  }
  async listPlatformAccounts() {
    const { backend, token } = await this.backendAndToken();
    return fetchPlatformAccounts(backend, token);
  }
  async createPlatformAccount(input) {
    const { backend, token } = await this.backendAndToken();
    return createPlatformAccount(backend, token, input);
  }
  async updatePlatformAccount(accountId, input) {
    const { backend, token } = await this.backendAndToken();
    return updatePlatformAccount(backend, token, accountId, input);
  }
  async disablePlatformAccount(accountId) {
    return this.updatePlatformAccount(accountId, { status: "disabled" });
  }
  async updatePlatformAccountPassword(accountId, password) {
    return this.updatePlatformAccount(accountId, { password });
  }
  async listWorkspaceInvitations() {
    const { backend, token } = await this.backendAndToken();
    return fetchWorkspaceInvitations(backend, token);
  }
  async inviteWorkspaceMember(workspaceId, email) {
    const { backend, token } = await this.backendAndToken();
    return inviteWorkspaceMember(backend, token, workspaceId, email);
  }
  async acceptWorkspaceInvitation(invitationId) {
    const { backend, token } = await this.backendAndToken();
    return acceptWorkspaceInvitation(backend, token, invitationId);
  }
  async deleteWorkspaceInvitation(invitationId) {
    const { backend, token } = await this.backendAndToken();
    return deleteWorkspaceInvitation(backend, token, invitationId);
  }
  async listProjectInvitations() {
    const { backend, token } = await this.backendAndToken();
    return fetchProjectInvitations(backend, token);
  }
  async inviteProjectMember(input) {
    const { backend, token } = await this.backendAndToken();
    return inviteProjectMember(backend, token, input);
  }
  async acceptProjectInvitation(invitationId) {
    const { backend, token } = await this.backendAndToken();
    return acceptProjectInvitation(backend, token, invitationId);
  }
  async deleteProjectInvitation(invitationId) {
    const { backend, token } = await this.backendAndToken();
    return deleteProjectInvitation(backend, token, invitationId);
  }
  async createMemberAccount(input) {
    const { backend, token } = await this.backendAndToken();
    return createMemberAccount(backend, token, input);
  }
  async updateMemberAccount(memberId, input) {
    const { backend, token } = await this.backendAndToken();
    return updateMemberAccount(backend, token, memberId, input);
  }
};

// cli/src/confirmation.ts
var requireConfirmation = (confirmed, action) => {
  if (!confirmed) {
    throw new Error(`${action} requires explicit user confirmation. Ask the user to confirm, then call again with confirmed=true.`);
  }
};

// src/memberStatusPeople.ts
var normalizedEmail4 = (email) => email?.trim().toLowerCase();
var memberStatusIdentityKeys = (identity) => [
  identity.accountId ? `account:${identity.accountId}` : "",
  normalizedEmail4(identity.email) ? `email:${normalizedEmail4(identity.email)}` : "",
  identity.id ? `member:${identity.id}` : ""
].filter(Boolean);
var mergeIdentityKeys = (left, right) => Array.from(/* @__PURE__ */ new Set([...left, ...right]));
var findMemberStatusPerson = (people, keys) => people.find((person) => keys.some((key) => person.identityKeys.includes(key)));
var buildMemberStatusPeople = (projectMembers, workspaceMemberships = []) => {
  const people = [];
  workspaceMemberships.filter((membership) => membership.status === "active").reduce((drafts, membership) => {
    const identityKeys = memberStatusIdentityKeys(membership);
    const existing = findMemberStatusPerson(drafts, identityKeys);
    if (!existing) {
      drafts.push({
        id: membership.accountId,
        name: membership.name,
        roles: [],
        accountId: membership.accountId,
        email: membership.email,
        memberIds: [],
        projectIds: [],
        workspaceIds: [membership.workspaceId],
        members: [],
        workspaceMemberships: [membership],
        identityKeys
      });
      return drafts;
    }
    existing.name = existing.name || membership.name;
    existing.accountId = existing.accountId ?? membership.accountId;
    existing.email = existing.email ?? membership.email;
    existing.workspaceIds = Array.from(/* @__PURE__ */ new Set([...existing.workspaceIds, membership.workspaceId]));
    existing.workspaceMemberships = [...existing.workspaceMemberships, membership];
    existing.identityKeys = mergeIdentityKeys(existing.identityKeys, identityKeys);
    return drafts;
  }, people);
  projectMembers.reduce((drafts, member) => {
    const identityKeys = memberStatusIdentityKeys(member);
    const existing = findMemberStatusPerson(drafts, identityKeys);
    if (!existing) {
      drafts.push({
        id: member.accountId ?? member.email ?? member.id,
        name: member.name,
        roles: member.roles,
        accountId: member.accountId,
        email: member.email,
        memberIds: [member.id],
        projectIds: [member.projectId],
        workspaceIds: [],
        members: [member],
        workspaceMemberships: [],
        identityKeys
      });
      return drafts;
    }
    existing.roles = Array.from(/* @__PURE__ */ new Set([...existing.roles, ...member.roles]));
    existing.accountId = existing.accountId ?? member.accountId;
    existing.email = existing.email ?? member.email;
    existing.memberIds = Array.from(/* @__PURE__ */ new Set([...existing.memberIds, member.id]));
    existing.projectIds = Array.from(/* @__PURE__ */ new Set([...existing.projectIds, member.projectId]));
    existing.members = [...existing.members, member];
    existing.identityKeys = mergeIdentityKeys(existing.identityKeys, identityKeys);
    return drafts;
  }, people);
  return people.map(({ identityKeys: _identityKeys, ...person }) => person);
};

// src/projectTaskDisplay.ts
var projectTaskStatusColumns = [
  { status: "pool", title: "\u4EFB\u52A1\u6C60" },
  { status: "committed", title: "\u5DF2\u5B89\u6392" },
  { status: "in_progress", title: "\u8FDB\u884C\u4E2D" },
  { status: "pending_review", title: "\u5F85\u9A8C\u6536" },
  { status: "completed", title: "\u5DF2\u5B8C\u6210" },
  { status: "split", title: "\u5DF2\u62C6\u5206" },
  { status: "archived", title: "\u5DF2\u5F52\u6863" }
];
var statusTitleByStatus = Object.fromEntries(projectTaskStatusColumns.map((column) => [column.status, column.title]));
var canShowActiveState = (status) => status === "in_progress";
var stageTaskSortRank = (status, isActive, isTodayTask) => {
  if (status === "pending_review") return 0;
  if (isActive && canShowActiveState(status)) return 1;
  if (isTodayTask) return 2;
  return 3;
};

// src/memberStatusTasks.ts
var memberProjectRoleLabel = (members, projectId) => {
  const projectMember = members.find((member) => member.projectId === projectId);
  if (!projectMember) return "\u6210\u5458";
  return projectMember.roles.includes("project_owner") ? "\u9879\u76EE\u8D1F\u8D23\u4EBA" : "\u6267\u884C\u8005";
};
var groupMemberTasksByProject = (member, tasks, projectNameById, workspaceNameByProjectId) => {
  const groups = /* @__PURE__ */ new Map();
  const ensureGroup = (projectId, fallbackName) => {
    const existing = groups.get(projectId);
    if (existing) {
      if (fallbackName && existing.tasks.length === 0) existing.projectName = fallbackName;
      return existing;
    }
    const group = {
      projectId,
      projectName: projectNameById.get(projectId) ?? fallbackName ?? "\u672A\u5F52\u5C5E\u9879\u76EE",
      workspaceName: workspaceNameByProjectId.get(projectId),
      roleLabel: memberProjectRoleLabel(member.members, projectId),
      tasks: []
    };
    groups.set(projectId, group);
    return group;
  };
  member.projectIds.forEach((projectId) => ensureGroup(projectId));
  tasks.forEach((task) => ensureGroup(task.projectId || task.project || "unknown_project", task.project).tasks.push(task));
  return Array.from(groups.values());
};
var taskBelongsToMemberStatusPerson = (task, member, memberIds) => {
  const collaboratorMemberIds = task.collaboratorMemberIds ?? [];
  const isExplicitlyAssigned = Boolean(
    task.primaryExecutorMemberId && memberIds.has(task.primaryExecutorMemberId) || collaboratorMemberIds.some((memberId) => memberIds.has(memberId))
  );
  const isUnassigned = !task.primaryExecutorMemberId && collaboratorMemberIds.length === 0;
  return isExplicitlyAssigned || isUnassigned && member.roles.includes("project_owner") && member.projectIds.includes(task.projectId);
};
var sortMemberStatusTasks = (tasks, runningTask) => [...tasks].sort((left, right) => {
  if (left.id === runningTask?.id) return -1;
  if (right.id === runningTask?.id) return 1;
  const statusDelta = stageTaskSortRank(left.status, false, true) - stageTaskSortRank(right.status, false, true);
  if (statusDelta !== 0) return statusDelta;
  return left.sortOrder - right.sortOrder;
});

// src/memberStatusColumns.ts
var sourceProjectIdsForMemberStatus = (state, projectId, workspaceId) => {
  const accessibleProjectIds = accessibleProjectIdsForCurrentUser(state);
  const projectIds = projectId ? new Set(accessibleProjectIds.has(projectId) ? [projectId] : []) : accessibleProjectIds;
  if (!workspaceId) return projectIds;
  return new Set(
    state.projects.filter((project) => projectIds.has(project.id) && workspaceIdForProject(state, project) === workspaceId).map((project) => project.id)
  );
};
var sourceTasksForMemberStatus = (state, sourceProjectIds) => state.tasks.filter(
  (task) => task.status !== "split" && task.status !== "archived" && sourceProjectIds.has(task.projectId)
);
var todayTaskIdsForMemberStatus = (state, sourceTaskIds, date) => new Set(
  state.dailyPlans.filter((plan) => plan.date === date).flatMap((plan) => plan.committedTaskIds).filter((taskId) => sourceTaskIds.has(taskId))
);
var buildMemberStatusColumns = (state, projectId, date = today(), workspaceId) => {
  const sourceProjectIds = sourceProjectIdsForMemberStatus(state, projectId, workspaceId);
  const accessibleWorkspaceIds = activeWorkspaceIdsForCurrentAccount(state);
  const sourceWorkspaceIds = new Set(
    state.projects.filter((project) => sourceProjectIds.has(project.id)).map((project) => workspaceIdForProject(state, project)).filter((workspaceId2) => typeof workspaceId2 === "string" && accessibleWorkspaceIds.has(workspaceId2))
  );
  const sourceProjectMembers = state.projectMembers.filter((member) => sourceProjectIds.has(member.projectId) && member.status !== "disabled");
  const sourceWorkspaceMemberships = workspaceMembershipsForState(state).filter(
    (membership) => sourceWorkspaceIds.has(membership.workspaceId) && membership.status === "active"
  );
  const members = buildMemberStatusPeople(sourceProjectMembers, sourceWorkspaceMemberships);
  const sourceTasks = sourceTasksForMemberStatus(state, sourceProjectIds);
  const sourceTaskIds = new Set(sourceTasks.map((task) => task.id));
  const todayTaskIdSet = todayTaskIdsForMemberStatus(state, sourceTaskIds, date);
  const activeSessions = state.workSessions.filter((session) => session.status === "active" && sourceTasks.some((task) => task.id === session.taskId)).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const projectNameById = new Map(state.projects.map((project) => [project.id, project.name]));
  const workspaceNameByProjectId = new Map(
    state.projects.flatMap((project) => {
      const workspaceName2 = workspaceForProject(state, project)?.name;
      return workspaceName2 ? [[project.id, workspaceName2]] : [];
    })
  );
  return members.map((member) => {
    const memberIdSet = new Set(member.memberIds);
    const runningSession = activeSessions.find((session) => session.executorMemberId && memberIdSet.has(session.executorMemberId));
    const runningTask = runningSession ? sourceTasks.find((task) => task.id === runningSession.taskId) : void 0;
    const memberTodayTasks = sortMemberStatusTasks(
      sourceTasks.filter(
        (task) => (todayTaskIdSet.has(task.id) || task.id === runningTask?.id) && taskBelongsToMemberStatusPerson(task, member, memberIdSet)
      ),
      runningTask
    );
    const displayedTasks = runningTask && !memberTodayTasks.some((task) => task.id === runningTask.id) ? [runningTask, ...memberTodayTasks] : memberTodayTasks;
    const projectTaskGroups = groupMemberTasksByProject(member, displayedTasks, projectNameById, workspaceNameByProjectId).filter((group) => group.tasks.length > 0);
    return {
      ...member,
      displayedTasks,
      projectTaskGroups,
      runningTask
    };
  });
};

// cli/src/views.ts
var workspaceName = (state, workspaceId) => workspaceId ? state.auth.workspaces?.find((workspace) => workspace.id === workspaceId)?.name ?? state.auth.workspace?.name : void 0;
var projectForTask = (state, task) => state.projects.find((project) => project.id === task.projectId);
var memberName2 = (state, memberId) => memberId ? state.projectMembers.find((member) => member.id === memberId)?.name : void 0;
var compactProject = (state, project) => ({
  id: project.id,
  workspaceId: project.workspaceId,
  workspaceName: workspaceName(state, project.workspaceId),
  name: project.name,
  description: project.description,
  defaultExpectedStartHours: project.defaultExpectedStartHours,
  taskStageMode: project.taskStageMode,
  archivedAt: project.archivedAt,
  taskCount: state.tasks.filter((task) => task.projectId === project.id && task.status !== "archived" && task.status !== "split").length,
  memberCount: countProjectAccessibleMembers(state, project, project.workspaceId),
  updatedAt: project.updatedAt
});
var compactMember = (state, member) => ({
  id: member.id,
  workspaceId: member.workspaceId,
  workspaceName: workspaceName(state, member.workspaceId),
  projectId: member.projectId,
  projectName: state.projects.find((project) => project.id === member.projectId)?.name,
  accountId: member.accountId,
  name: member.name,
  email: member.email,
  roles: member.roles,
  status: member.status ?? "active",
  updatedAt: member.updatedAt
});
var compactTask = (state, task) => {
  const project = projectForTask(state, task);
  return {
    id: task.id,
    workspaceId: task.workspaceId ?? project?.workspaceId,
    workspaceName: workspaceName(state, task.workspaceId ?? project?.workspaceId),
    title: task.title,
    notes: task.notes,
    tags: task.tags,
    projectId: task.projectId,
    project: task.project,
    primaryExecutorMemberId: task.primaryExecutorMemberId,
    primaryExecutorName: memberName2(state, task.primaryExecutorMemberId),
    collaboratorMemberIds: task.collaboratorMemberIds ?? [],
    status: task.status,
    priority: task.priority,
    severity: task.severity,
    stage: task.stage,
    progressPercent: task.progressPercent ?? 0,
    progressNote: task.progressNote,
    estimatePomodoros: task.estimatePomodoros,
    actualPomodoros: task.actualPomodoros,
    expectedStartAt: task.expectedStartAt,
    expectedFinishAt: task.expectedFinishAt,
    dueAt: task.dueAt,
    reminderAt: task.reminderAt,
    repeatRule: task.repeatRule,
    repeatIntervalDays: task.repeatIntervalDays,
    subtasks: task.subtasks,
    reviewSubmittedAt: task.reviewSubmittedAt,
    reviewAcceptedAt: task.reviewAcceptedAt,
    reviewReturnedAt: task.reviewReturnedAt,
    reviewReturnReason: task.reviewReturnReason,
    completedAt: task.completedAt,
    updatedAt: task.updatedAt
  };
};
var taskMatchesFilter = (task, filter) => {
  if (filter.projectId && task.projectId !== filter.projectId) return false;
  if (!filter.includeArchived && task.status === "archived") return false;
  if (!filter.includeSplit && task.status === "split") return false;
  if (filter.status && filter.status !== "all" && task.status !== filter.status) return false;
  if (filter.assigneeMemberId) {
    const collaborators = task.collaboratorMemberIds ?? [];
    if (task.primaryExecutorMemberId !== filter.assigneeMemberId && !collaborators.includes(filter.assigneeMemberId)) return false;
  }
  const query = filter.query?.trim().toLowerCase();
  if (query && !`${task.title} ${task.notes} ${task.project} ${task.tags.join(" ")}`.toLowerCase().includes(query)) return false;
  return true;
};
var listProjectViews = (state) => sortedByUpdatedAt(state.projects.filter((project) => !project.archivedAt)).map((project) => compactProject(state, project));
var listTaskViews = (state, filter = {}) => sortedByUpdatedAt(state.tasks.filter((task) => taskMatchesFilter(task, filter))).map((task) => compactTask(state, task));
var taskDetailView = (state, taskId) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return {
    ...compactTask(state, task),
    projectDetail: state.projects.find((project) => project.id === task.projectId),
    workSessions: state.workSessions.filter((session) => session.taskId === taskId),
    executionSignals: state.executionSignals.filter((signal) => signal.taskId === taskId),
    interruptions: state.interruptions.filter((interruption) => interruption.taskId === taskId)
  };
};
var planTasks = (state, plan) => plan.committedTaskIds.map((taskId) => state.tasks.find((task) => task.id === taskId)).filter((task) => Boolean(task)).map((task) => compactTask(state, task));
var dailyPlanView = (state, date = today()) => {
  const plans = date === today() ? currentAccountDailyPlansForDate(state, date) : currentAccountDailyPlansForDate(state, date);
  const combined = date === today() ? getTodayPlan(state) : plans[0];
  return {
    date,
    combined: combined ? {
      ...combined,
      tasks: planTasks(state, combined)
    } : void 0,
    plans: plans.map((plan) => ({
      ...plan,
      workspaceName: workspaceName(state, plan.workspaceId),
      tasks: planTasks(state, plan)
    }))
  };
};
var todayWorkbenchView = (state, projectId, date = today()) => buildMemberStatusColumns(state, projectId, date).map((member) => ({
  id: member.id,
  name: member.name,
  accountId: member.accountId,
  email: member.email,
  roles: member.roles,
  projectIds: member.projectIds,
  workspaceIds: member.workspaceIds,
  runningTask: member.runningTask ? compactTask(state, member.runningTask) : void 0,
  displayedTasks: member.displayedTasks.map((task) => compactTask(state, task)),
  projectTaskGroups: member.projectTaskGroups.map((group) => ({
    ...group,
    tasks: group.tasks.map((task) => compactTask(state, task))
  }))
}));
var sessionView = (state, session) => ({
  ...session,
  task: state.tasks.find((task) => task.id === session.taskId) ? compactTask(state, state.tasks.find((task) => task.id === session.taskId)) : void 0,
  executorName: memberName2(state, session.executorMemberId)
});
var activeWorkView = (state, projectId) => sortedByUpdatedAt(state.workSessions.filter((session) => {
  if (session.status !== "active" && session.status !== "paused") return false;
  if (!projectId) return true;
  return state.tasks.some((task) => task.id === session.taskId && task.projectId === projectId);
})).map((session) => sessionView(state, session));
var projectOverviewView = (state, projectId) => {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const tasks = state.tasks.filter((task) => task.projectId === projectId);
  const statusCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});
  const board = buildProgressBoard(state, projectId);
  return {
    project: compactProject(state, project),
    statusCounts,
    progress: board.projectProgress,
    activeSessions: board.activeSessions,
    riskSections: board.sections.filter((section) => section.kind !== "normal" && section.tasks.length > 0),
    members: state.projectMembers.filter((member) => member.projectId === projectId).map((member) => compactMember(state, member))
  };
};
var riskTasksView = (state, projectId) => {
  const projects = projectId ? state.projects.filter((project) => project.id === projectId) : state.projects.filter((project) => !project.archivedAt);
  return projects.flatMap(
    (project) => buildProgressBoard(state, project.id).sections.filter((section) => section.kind !== "normal").flatMap((section) => section.tasks.map((task) => ({ projectId: project.id, projectName: project.name, section: section.kind, ...task })))
  );
};
var searchView = (state, query, limit = 10) => {
  const normalized = query.trim().toLowerCase();
  const includes = (...values) => values.join(" ").toLowerCase().includes(normalized);
  if (!normalized) return { projects: [], members: [], tasks: [] };
  return {
    projects: state.projects.filter((project) => includes(project.name, project.description)).slice(0, limit).map((project) => compactProject(state, project)),
    members: state.projectMembers.filter((member) => includes(member.name, member.email)).slice(0, limit).map((member) => compactMember(state, member)),
    tasks: state.tasks.filter((task) => includes(task.title, task.notes, task.project, task.tags.join(" "))).slice(0, limit).map((task) => compactTask(state, task))
  };
};
var dailySummaryView = (state, date = today()) => {
  const plans = currentAccountDailyPlansForDate(state, date);
  const taskIds = new Set(plans.flatMap((plan) => plan.committedTaskIds));
  const sessions = state.workSessions.filter((session) => taskIds.has(session.taskId) || session.startedAt.slice(0, 10) === date);
  return {
    date,
    plans: plans.map((plan) => ({ ...plan, workspaceName: workspaceName(state, plan.workspaceId), tasks: planTasks(state, plan) })),
    totals: {
      plans: plans.length,
      tasks: taskIds.size,
      completedTasks: state.tasks.filter((task) => taskIds.has(task.id) && task.status === "completed").length,
      workSessions: sessions.length,
      completedPomodoros: plans.reduce((sum, plan) => sum + plan.completedPomodoros, 0)
    },
    workSessions: sessions.map((session) => sessionView(state, session)),
    interruptions: state.interruptions.filter((interruption) => interruption.createdAt.slice(0, 10) === date)
  };
};

// cli/src/clientProjects.ts
var TimeManageProjectClient = class extends TimeManageBaseClient {
  async listProjects() {
    return listProjectViews(await this.authenticatedState());
  }
  async search(query, limit) {
    return searchView(await this.authenticatedState(), query, limit);
  }
  async getProjectOverview(projectId) {
    return projectOverviewView(await this.authenticatedState(), projectId);
  }
  async createProject(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => {
      const next = createProjectInTeamState(state, input, timestamp);
      const project = next.projects.find((item) => !state.projects.some((existing) => existing.id === item.id));
      return { state: next, result: project?.id };
    });
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === saved.result));
  }
  async updateProject(projectId, input) {
    const saved = await this.mutate(projectId, (state, timestamp) => ({
      state: updateProjectInTeamState(state, projectId, input, timestamp),
      result: projectId
    }));
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === projectId));
  }
  async archiveProject(projectId, confirmed) {
    requireConfirmation(confirmed, "archive_project");
    const saved = await this.mutate(projectId, (state, timestamp) => ({
      state: archiveProjectInTeamState(state, projectId, timestamp),
      result: projectId
    }));
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === projectId));
  }
  async restoreProject(projectId) {
    const saved = await this.mutate(projectId, (state, timestamp) => ({
      state: restoreProjectInTeamState(state, projectId, timestamp),
      result: projectId
    }));
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === projectId));
  }
  async listMembers(projectId, includeDisabled = false) {
    const state = await this.authenticatedState();
    return state.projectMembers.filter((member) => (!projectId || member.projectId === projectId) && (includeDisabled || member.status !== "disabled")).map((member) => compactMember(state, member));
  }
  async createMember(input) {
    const saved = await this.mutate(input.projectId, (state, timestamp) => {
      const next = createProjectMemberInTeamState(state, input, timestamp);
      const created = next.projectMembers.find((item) => !state.projectMembers.some((existing) => existing.id === item.id));
      const matched = created ?? next.projectMembers.find(
        (member) => member.projectId === input.projectId && (input.accountId && member.accountId === input.accountId || input.email && member.email?.toLowerCase() === input.email.toLowerCase() || member.name === (input.name.trim() || "\u65B0\u6210\u5458"))
      );
      return { state: next, result: matched?.id };
    });
    return compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === saved.result));
  }
  async updateMember(projectMemberId, input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: updateProjectMemberInTeamState(state, projectMemberId, input, timestamp),
      result: projectMemberId
    }));
    return compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === projectMemberId));
  }
  async deleteMember(projectMemberId, confirmed) {
    requireConfirmation(confirmed, "delete_member");
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: unbindProjectMemberInTeamState(state, projectMemberId, timestamp),
      result: projectMemberId
    }));
    return compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === projectMemberId));
  }
  async bindMemberToProject(projectId, memberRef, roles) {
    const saved = await this.mutate(projectId, (state, timestamp) => {
      const next = bindMemberToProjectInTeamState(state, projectId, memberRef, roles, timestamp);
      const member = next.projectMembers.find((item) => !state.projectMembers.some((existing) => existing.id === item.id));
      return { state: next, result: member?.id };
    });
    return saved.result ? compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === saved.result)) : void 0;
  }
  async updateProjectMember(projectMemberId, input) {
    return this.updateMember(projectMemberId, input);
  }
  async unbindProjectMember(projectMemberId, confirmed) {
    requireConfirmation(confirmed, "unbind_project_member");
    return this.deleteMember(projectMemberId, true);
  }
  async listRiskTasks(projectId) {
    return riskTasksView(await this.authenticatedState(), projectId);
  }
};

// cli/src/clientTasks.ts
var TimeManageTaskClient = class extends TimeManageProjectClient {
  async listTasks(filter = {}) {
    return listTaskViews(await this.authenticatedState(), filter);
  }
  async getTask(taskId) {
    return taskDetailView(await this.authenticatedState(), taskId);
  }
  async createTask(input) {
    const saved = await this.mutate(input.projectId, (state, timestamp) => {
      const next = createTaskInTeamState(state, input, timestamp);
      const task = next.tasks.find((item) => !state.tasks.some((existing) => existing.id === item.id));
      return { state: next, result: task?.id };
    });
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === saved.result));
  }
  async batchCreateTasks(projectId, tasks) {
    const saved = await this.mutate(projectId, (state, timestamp) => {
      let next = state;
      const createdIds = [];
      for (const task of tasks) {
        const beforeIds = new Set(next.tasks.map((item) => item.id));
        next = createTaskInTeamState(next, { ...task, projectId }, timestamp);
        const created = next.tasks.find((item) => !beforeIds.has(item.id));
        if (created) createdIds.push(created.id);
      }
      return { state: next, result: createdIds };
    });
    return saved.result.map((taskId) => compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)));
  }
  async updateTask(taskId, input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: updateTaskInTeamState(state, taskId, input, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async deleteTask(taskId, confirmed) {
    requireConfirmation(confirmed, "delete_task");
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: deleteTaskInTeamState(state, taskId, timestamp),
      result: taskId
    }));
    return { deletedTaskId: taskId, savedAt: saved.savedAt };
  }
  async assignTask(taskId, assignment) {
    const saved = await this.mutate(assignment.projectId, (state, timestamp) => ({
      state: assignTaskInTeamState(state, taskId, assignment, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async batchAssignTasks(taskIds, assignment) {
    const saved = await this.mutate(assignment.projectId, (state, timestamp) => ({
      state: taskIds.reduce((current, taskId) => assignTaskInTeamState(current, taskId, assignment, timestamp), state),
      result: taskIds
    }));
    return saved.result.map((taskId) => compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)));
  }
  async setTaskStatus(taskId, status, confirmed) {
    if (status === "completed" || status === "split" || status === "archived") requireConfirmation(confirmed, "set_task_status");
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: setTaskStatusInTeamState(state, taskId, status, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async updateTaskProgress(taskId, progressPercent, progressNote = "") {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: updateTaskProgressInTeamState(state, taskId, progressPercent, progressNote, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async splitTask(taskId, childTitles, confirmed) {
    requireConfirmation(confirmed, "split_task");
    const saved = await this.mutate(void 0, (state, timestamp) => {
      const next = splitTaskInTeamState(state, taskId, childTitles, timestamp);
      return { state: next, result: next.tasks.filter((task) => !state.tasks.some((existing) => existing.id === task.id)).map((task) => task.id) };
    });
    return saved.result.map((id) => compactTask(saved.state, saved.state.tasks.find((task) => task.id === id)));
  }
};

// cli/src/clientWorkflow.ts
var TimeManageWorkflowClient = class extends TimeManageTaskClient {
  async getTodayPlan(date) {
    return dailyPlanView(await this.authenticatedState(), date);
  }
  async getTodayWorkbench(projectId, date) {
    return todayWorkbenchView(await this.authenticatedState(), projectId, date);
  }
  async addTaskToToday(taskId) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: addTaskToTodayInTeamState(state, taskId, timestamp),
      result: taskId
    }));
    return dailyPlanView(saved.state);
  }
  async batchAddTasksToToday(taskIds) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: batchAddTasksToTodayInTeamState(state, taskIds, timestamp),
      result: taskIds
    }));
    return dailyPlanView(saved.state);
  }
  async removeTaskFromToday(taskId) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: removeTaskFromTodayInTeamState(state, taskId, timestamp),
      result: taskId
    }));
    return dailyPlanView(saved.state);
  }
  async moveTodayTask(taskId, direction) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: moveTodayTaskInTeamState(state, taskId, direction, timestamp),
      result: taskId
    }));
    return dailyPlanView(saved.state);
  }
  async scheduleTaskForDate(taskId, date) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: scheduleTaskForDateInState(state, taskId, date, timestamp),
      result: taskId
    }));
    return dailyPlanView(saved.state, date);
  }
  async startTask(taskId) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: startTaskInTeamState(state, taskId, timestamp),
      result: taskId
    }));
    return activeWorkView(saved.state);
  }
  async pauseWorkSession(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: pauseWorkSessionInTeamState(state, input, timestamp),
      result: input
    }));
    return activeWorkView(saved.state);
  }
  async resumeWorkSession(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: resumeWorkSessionInTeamState(state, input, timestamp),
      result: input
    }));
    return activeWorkView(saved.state);
  }
  async finishWorkSession(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: finishWorkSessionInTeamState(state, input, timestamp),
      result: input
    }));
    return activeWorkView(saved.state);
  }
  async getActiveWork(projectId) {
    return activeWorkView(await this.authenticatedState(), projectId);
  }
  async recordInterruption(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => {
      const next = recordInterruptionInTeamState(state, input, timestamp);
      return { state: next, result: next.interruptions[0]?.id };
    });
    return saved.state.interruptions.find((item) => item.id === saved.result);
  }
  async submitTaskReview(taskId) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: submitTaskReviewInTeamState(state, taskId, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async acceptTaskReview(taskId, confirmed) {
    requireConfirmation(confirmed, "accept_task_review");
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: acceptTaskReviewInTeamState(state, taskId, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async returnTaskReview(taskId, reason) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: returnTaskReviewInTeamState(state, taskId, reason, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async listPendingReviews(projectId) {
    return this.listTasks({ projectId, status: "pending_review", includeArchived: false, includeSplit: false });
  }
  async getMemberStatus(projectId, date) {
    return todayWorkbenchView(await this.authenticatedState(), projectId, date);
  }
  async getDailySummary(date) {
    return dailySummaryView(await this.authenticatedState(), date);
  }
  async updateDailyReview(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: updateDailyReviewInTeamState(state, input, timestamp),
      result: input.date
    }));
    return dailySummaryView(saved.state, input.date);
  }
  async getSettings() {
    return (await this.authenticatedState()).settings;
  }
  async updateSettings(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: updateSettingsInTeamState(state, input, timestamp),
      result: void 0
    }));
    return saved.state.settings;
  }
  async listTaskTemplates() {
    const state = await this.authenticatedState();
    return state.taskTemplates;
  }
  async saveTaskTemplate(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => {
      const next = saveTaskTemplateInTeamState(state, input, timestamp);
      return { state: next, result: input.id ?? next.taskTemplates[0]?.id };
    });
    return saved.state.taskTemplates.find((template) => template.id === saved.result);
  }
  async deleteTaskTemplate(templateId, confirmed) {
    requireConfirmation(confirmed, "delete_task_template");
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: deleteTaskTemplateInTeamState(state, templateId, timestamp),
      result: templateId
    }));
    return { deletedTemplateId: templateId, savedAt: saved.savedAt };
  }
  async instantiateTaskTemplate(templateId, projectId) {
    const saved = await this.mutate(projectId, (state, timestamp) => {
      const next = instantiateTaskTemplateInTeamState(state, templateId, projectId, timestamp);
      const taskId = next.templateInstances[0]?.taskId;
      return { state: next, result: taskId };
    });
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === saved.result));
  }
};

// cli/src/client.ts
var TimeManageClient = class extends TimeManageWorkflowClient {
};

// cli/src/commandSupport.ts
import { readFileSync } from "node:fs";
var parseData = (value) => {
  const source = value.startsWith("@") ? readFileSync(value.slice(1), "utf8") : value;
  try {
    return JSON.parse(source);
  } catch {
    throw new Error("--data must be valid JSON or @path-to-json-file.");
  }
};
var splitList = (value) => value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
var numberValue = (value, label, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number.`);
  if (min !== void 0 && parsed < min) throw new Error(`${label} must be >= ${min}.`);
  if (max !== void 0 && parsed > max) throw new Error(`${label} must be <= ${max}.`);
  return parsed;
};
var integerValue = (value, label, min, max) => {
  const parsed = numberValue(value, label, min, max);
  if (!Number.isInteger(parsed)) throw new Error(`${label} must be an integer.`);
  return parsed;
};
var enumValue = (value, label, allowed) => {
  if (!allowed.includes(value)) throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  return value;
};
var entityLabel = (entity) => String(entity.title ?? entity.name ?? entity.email ?? entity.id ?? "result");
var formatEntity = (entity) => {
  const label = entityLabel(entity);
  const suffix = [entity.status, entity.progressPercent === void 0 ? void 0 : `${entity.progressPercent}%`].filter((value) => value !== void 0 && value !== "").join(" \xB7 ");
  const id = entity.id ? ` (${entity.id})` : "";
  return `${label}${suffix ? ` \u2014 ${suffix}` : ""}${id}`;
};
var writeResult = (write, value, json) => {
  if (json || value === null || value === void 0) {
    write(`${JSON.stringify(value ?? null, null, 2)}
`);
    return;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    write(`${String(value)}
`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      write("\u6CA1\u6709\u7ED3\u679C\u3002\n");
      return;
    }
    for (const item of value) {
      write(`${item && typeof item === "object" ? formatEntity(item) : String(item)}
`);
    }
    return;
  }
  const entity = value;
  if (entity.id || entity.title || entity.name || entity.email) {
    write(`${formatEntity(entity)}
`);
    return;
  }
  write(`${JSON.stringify(value, null, 2)}
`);
};
var uniqueEntity = (items, ref, kind, keys) => {
  const normalized = ref.trim().toLowerCase();
  const exact = items.filter((item) => keys.some((key) => String(item[key] ?? "").toLowerCase() === normalized));
  if (exact.length === 1) return String(exact[0].id);
  const fuzzy = items.filter((item) => keys.some((key) => String(item[key] ?? "").toLowerCase().includes(normalized)));
  if (fuzzy.length === 1) return String(fuzzy[0].id);
  const matches = exact.length > 1 ? exact : fuzzy;
  if (matches.length > 1) throw new Error(`${kind} ref is ambiguous: ${ref}. Matches: ${matches.map(entityLabel).join(", ")}`);
  throw new Error(`${kind} not found: ${ref}`);
};
var resolveProjectId = async (client, ref) => uniqueEntity(await client.listProjects(), ref, "Project", ["id", "name"]);
var resolveTaskId = async (client, ref, projectId) => uniqueEntity(await client.listTasks({ projectId, status: "all", includeArchived: true, includeSplit: true }), ref, "Task", ["id", "title"]);
var resolveWorkspaceId = async (client, ref) => {
  const result = await client.listWorkspaces();
  return uniqueEntity(Array.isArray(result) ? result : result.workspaces ?? [], ref, "Workspace", ["id", "name"]);
};
var resolveWorkspaceMembershipId = async (client, ref, workspaceId) => {
  const result = await client.listWorkspaces();
  const memberships = workspaceId ? (result.memberships ?? []).filter((membership) => membership.workspaceId === workspaceId) : result.memberships ?? [];
  return uniqueEntity(memberships, ref, "Workspace membership", ["id", "name", "email"]);
};
var resolveMemberId = async (client, ref, projectId) => uniqueEntity(await client.listMembers(projectId, true), ref, "Member", ["id", "name", "email"]);
var resolveAccountId = async (client, ref) => uniqueEntity(await client.listPlatformAccounts(), ref, "Account", ["id", "name", "email"]);
var resolveTemplateId = async (client, ref) => uniqueEntity(await client.listTaskTemplates(), ref, "Template", ["id", "name"]);
var resolveWorkspaceInvitationId = async (client, ref) => uniqueEntity(await client.listWorkspaceInvitations(), ref, "Workspace invitation", ["id", "inviteeEmail", "email"]);
var resolveProjectInvitationId = async (client, ref) => uniqueEntity(await client.listProjectInvitations(), ref, "Project invitation", ["id", "inviteeEmail", "email", "projectName"]);
var addDataOption = (command, description = "JSON object or @path.json") => command.requiredOption("--data <json-or-file>", description);

// cli/src/config.ts
import { existsSync, readFileSync as readFileSync2 } from "node:fs";
import { homedir, hostname, platform } from "node:os";
import { join, resolve } from "node:path";
var defaultConfigPath = () => {
  if (platform() === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "TimeManage CLI", "config.json");
  }
  return join(homedir(), ".config", "timemanage-cli", "config.json");
};
var readJsonConfig = (path) => {
  if (!path) return {};
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    throw new Error(`TimeManage config file not found: ${resolved}`);
  }
  return JSON.parse(readFileSync2(resolved, "utf8"));
};
var firstValue = (...values) => values.find((value) => value !== void 0 && value.trim() !== "")?.trim();
function loadConfig(env = process.env) {
  const configPath = env.TM_CLI_CONFIG || (existsSync(defaultConfigPath()) ? defaultConfigPath() : void 0);
  const fileConfig = readJsonConfig(configPath);
  const serverUrl = firstValue(env.TM_CLI_SERVER_URL, fileConfig.serverUrl, "http://127.0.0.1:8787");
  const email = firstValue(env.TM_CLI_EMAIL, fileConfig.email);
  const password = firstValue(env.TM_CLI_PASSWORD, fileConfig.password);
  const deviceId = firstValue(env.TM_CLI_DEVICE_ID, fileConfig.deviceId, `timemanage_cli_${hostname()}`);
  if (!email || !password) {
    throw new Error("TimeManage CLI requires account and password via local config or environment.");
  }
  return { serverUrl, email, password, deviceId };
}

// cli/src/commands/accountWorkspaceCommands.ts
function registerAccountWorkspaceCommands(program2, runtime) {
  const account = program2.command("account").description("\u8D26\u53F7\u64CD\u4F5C");
  account.command("show").description("\u67E5\u770B\u5F53\u524D\u8D26\u53F7").action(async () => runtime.output(await runtime.client().getCurrentAccount()));
  const platform2 = account.command("platform").description("\u5E73\u53F0\u8D26\u53F7\u7BA1\u7406");
  platform2.command("list").action(async () => runtime.output(await runtime.client().listPlatformAccounts()));
  addDataOption(platform2.command("create")).action(async (options) => runtime.output(await runtime.client().createPlatformAccount(
    parseData(options.data)
  )));
  addDataOption(platform2.command("update").argument("<account>")).action(async (accountRef, options) => {
    const client = runtime.client();
    runtime.output(await client.updatePlatformAccount(
      await resolveAccountId(client, accountRef),
      parseData(options.data)
    ));
  });
  platform2.command("disable <account>").action(async (accountRef) => {
    const client = runtime.client();
    runtime.output(await client.disablePlatformAccount(await resolveAccountId(client, accountRef)));
  });
  platform2.command("password <account>").requiredOption("--password <password>").action(async (accountRef, options) => {
    const client = runtime.client();
    runtime.output(await client.updatePlatformAccountPassword(await resolveAccountId(client, accountRef), options.password));
  });
  const memberAccount = account.command("member").description("\u9879\u76EE\u6210\u5458\u8D26\u53F7\u7BA1\u7406");
  addDataOption(memberAccount.command("create")).action(async (options) => runtime.output(await runtime.client().createMemberAccount(
    parseData(options.data)
  )));
  addDataOption(memberAccount.command("update").argument("<member>")).action(async (memberRef, options) => {
    const client = runtime.client();
    runtime.output(await client.updateMemberAccount(
      await resolveMemberId(client, memberRef),
      parseData(options.data)
    ));
  });
  const workspace = program2.command("workspace").description("\u5DE5\u4F5C\u533A\u64CD\u4F5C");
  workspace.command("list").action(async () => runtime.output(await runtime.client().listWorkspaces()));
  workspace.command("switch <workspace>").action(async (workspaceRef) => {
    const client = runtime.client();
    runtime.output(await client.switchWorkspace(await resolveWorkspaceId(client, workspaceRef)));
  });
  workspace.command("create").requiredOption("--name <name>").action(async (options) => runtime.output(await runtime.client().createWorkspace(options.name)));
  addDataOption(workspace.command("update").argument("<workspace>")).action(async (workspaceRef, options) => {
    const client = runtime.client();
    runtime.output(await client.updateWorkspace(
      await resolveWorkspaceId(client, workspaceRef),
      parseData(options.data)
    ));
  });
  addDataOption(workspace.command("member").command("update <workspace> <membership>")).action(async (workspaceRef, membershipRef, options) => {
    const client = runtime.client();
    const workspaceId = await resolveWorkspaceId(client, workspaceRef);
    runtime.output(await client.updateWorkspaceMembership(
      workspaceId,
      await resolveWorkspaceMembershipId(client, membershipRef, workspaceId),
      parseData(options.data)
    ));
  });
  const invitation = workspace.command("invitation").description("\u5DE5\u4F5C\u533A\u9080\u8BF7");
  invitation.command("list").action(async () => runtime.output(await runtime.client().listWorkspaceInvitations()));
  invitation.command("invite <workspace>").requiredOption("--email <email>").action(async (workspaceRef, options) => {
    const client = runtime.client();
    runtime.output(await client.inviteWorkspaceMember(await resolveWorkspaceId(client, workspaceRef), options.email));
  });
  invitation.command("accept <invitation>").action(async (invitationRef) => {
    const client = runtime.client();
    runtime.output(await client.acceptWorkspaceInvitation(await resolveWorkspaceInvitationId(client, invitationRef)));
  });
  invitation.command("delete <invitation>").action(async (invitationRef) => {
    const client = runtime.client();
    runtime.output(await client.deleteWorkspaceInvitation(await resolveWorkspaceInvitationId(client, invitationRef)));
  });
}

// cli/src/commands/projectCommands.ts
var projectRoles = (value) => {
  const roles = splitList(value);
  if (roles.some((role) => role !== "project_owner" && role !== "executor")) {
    throw new Error("--roles must contain project_owner or executor.");
  }
  return roles;
};
function registerProjectCommands(program2, runtime) {
  const project = program2.command("project").description("\u9879\u76EE\u64CD\u4F5C");
  project.command("list").action(async () => runtime.output(await runtime.client().listProjects()));
  project.command("show <project>").action(async (projectRef) => {
    const client = runtime.client();
    runtime.output(await client.getProjectOverview(await resolveProjectId(client, projectRef)));
  });
  project.command("create").requiredOption("--name <name>").option("--description <description>").option("--workspace <workspace-id>").option("--mode <regular-or-software>").option("--expected-start-hours <hours>").action(async (options) => {
    const client = runtime.client();
    runtime.output(await client.createProject({
      name: options.name,
      description: options.description,
      workspaceId: options.workspace ? await resolveWorkspaceId(client, options.workspace) : void 0,
      taskStageMode: options.mode ? enumValue(options.mode, "mode", ["regular", "software"]) : void 0,
      defaultExpectedStartHours: options.expectedStartHours === void 0 ? void 0 : numberValue(options.expectedStartHours, "expected-start-hours", 0)
    }));
  });
  addDataOption(project.command("update").argument("<project>")).action(async (projectRef, options) => {
    const client = runtime.client();
    runtime.output(await client.updateProject(
      await resolveProjectId(client, projectRef),
      parseData(options.data)
    ));
  });
  project.command("archive <project>").requiredOption("--yes", "\u786E\u8BA4\u5F52\u6863").action(async (projectRef) => {
    const client = runtime.client();
    runtime.output(await client.archiveProject(await resolveProjectId(client, projectRef), true));
  });
  project.command("restore <project>").action(async (projectRef) => {
    const client = runtime.client();
    runtime.output(await client.restoreProject(await resolveProjectId(client, projectRef)));
  });
  project.command("risks").option("--project <project>").action(async (options) => {
    const client = runtime.client();
    runtime.output(await client.listRiskTasks(options.project ? await resolveProjectId(client, options.project) : void 0));
  });
  const invitation = project.command("invitation").description("\u9879\u76EE\u9080\u8BF7");
  invitation.command("list").action(async () => runtime.output(await runtime.client().listProjectInvitations()));
  invitation.command("invite <project>").requiredOption("--email <email>").requiredOption("--roles <roles>").option("--workspace <workspace-id>").action(async (projectRef, options) => {
    const client = runtime.client();
    runtime.output(await client.inviteProjectMember({
      projectId: await resolveProjectId(client, projectRef),
      workspaceId: options.workspace ? await resolveWorkspaceId(client, options.workspace) : void 0,
      email: options.email,
      roles: projectRoles(options.roles)
    }));
  });
  invitation.command("accept <invitation>").action(async (invitationRef) => {
    const client = runtime.client();
    runtime.output(await client.acceptProjectInvitation(await resolveProjectInvitationId(client, invitationRef)));
  });
  invitation.command("delete <invitation>").action(async (invitationRef) => {
    const client = runtime.client();
    runtime.output(await client.deleteProjectInvitation(await resolveProjectInvitationId(client, invitationRef)));
  });
  const member = project.command("member").description("\u9879\u76EE\u6210\u5458");
  member.command("list").option("--project <project>").option("--include-disabled").action(async (options) => {
    const client = runtime.client();
    runtime.output(await client.listMembers(
      options.project ? await resolveProjectId(client, options.project) : void 0,
      Boolean(options.includeDisabled)
    ));
  });
  addDataOption(member.command("create").argument("<project>")).action(async (projectRef, options) => {
    const client = runtime.client();
    runtime.output(await client.createMember({
      ...parseData(options.data),
      projectId: await resolveProjectId(client, projectRef)
    }));
  });
  addDataOption(member.command("update").argument("<member>")).action(async (memberRef, options) => {
    const client = runtime.client();
    runtime.output(await client.updateProjectMember(
      await resolveMemberId(client, memberRef),
      parseData(options.data)
    ));
  });
  member.command("delete <member>").requiredOption("--yes", "\u786E\u8BA4\u5220\u9664\u6210\u5458").action(async (memberRef) => {
    const client = runtime.client();
    runtime.output(await client.deleteMember(await resolveMemberId(client, memberRef), true));
  });
  member.command("bind <project> <member>").requiredOption("--roles <roles>").action(async (projectRef, memberRef, options) => {
    const client = runtime.client();
    runtime.output(await client.bindMemberToProject(
      await resolveProjectId(client, projectRef),
      memberRef,
      projectRoles(options.roles)
    ));
  });
  member.command("unbind <member>").requiredOption("--yes", "\u786E\u8BA4\u89E3\u9664\u9879\u76EE\u7ED1\u5B9A").action(async (memberRef) => {
    const client = runtime.client();
    runtime.output(await client.unbindProjectMember(await resolveMemberId(client, memberRef), true));
  });
}

// cli/src/commands/reviewConfigCommands.ts
function registerReviewConfigCommands(program2, runtime) {
  const review = program2.command("review").description("\u4EFB\u52A1\u9A8C\u6536");
  review.command("submit <task>").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.submitTaskReview(await resolveTaskId(client, taskRef)));
  });
  review.command("accept <task>").requiredOption("--yes", "\u786E\u8BA4\u63A5\u53D7\u9A8C\u6536").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.acceptTaskReview(await resolveTaskId(client, taskRef), true));
  });
  review.command("return <task>").requiredOption("--reason <reason>").action(async (taskRef, options) => {
    const client = runtime.client();
    runtime.output(await client.returnTaskReview(await resolveTaskId(client, taskRef), options.reason));
  });
  review.command("pending").option("--project <project>").action(async (options) => {
    const client = runtime.client();
    runtime.output(await client.listPendingReviews(options.project ? await resolveProjectId(client, options.project) : void 0));
  });
  program2.command("member").command("status").option("--project <project>").option("--date <date>").action(async (options) => {
    const client = runtime.client();
    runtime.output(await client.getMemberStatus(
      options.project ? await resolveProjectId(client, options.project) : void 0,
      options.date
    ));
  });
  const daily = program2.command("daily").description("\u65E5\u62A5\u548C\u590D\u76D8");
  daily.command("summary").option("--date <date>").action(async (options) => runtime.output(await runtime.client().getDailySummary(options.date)));
  addDataOption(daily.command("review")).action(async (options) => runtime.output(await runtime.client().updateDailyReview(
    parseData(options.data)
  )));
  const settings = program2.command("settings").description("\u5E94\u7528\u8BBE\u7F6E");
  settings.command("show").action(async () => runtime.output(await runtime.client().getSettings()));
  addDataOption(settings.command("update")).action(async (options) => runtime.output(await runtime.client().updateSettings(
    parseData(options.data)
  )));
  const template = program2.command("template").description("\u4EFB\u52A1\u6A21\u677F");
  template.command("list").action(async () => runtime.output(await runtime.client().listTaskTemplates()));
  addDataOption(template.command("save")).action(async (options) => runtime.output(await runtime.client().saveTaskTemplate(
    parseData(options.data)
  )));
  template.command("delete <template>").requiredOption("--yes", "\u786E\u8BA4\u5220\u9664\u6A21\u677F").action(async (templateRef) => {
    const client = runtime.client();
    runtime.output(await client.deleteTaskTemplate(await resolveTemplateId(client, templateRef), true));
  });
  template.command("instantiate <template> <project>").action(async (templateRef, projectRef) => {
    const client = runtime.client();
    runtime.output(await client.instantiateTaskTemplate(
      await resolveTemplateId(client, templateRef),
      await resolveProjectId(client, projectRef)
    ));
  });
}

// cli/src/commands/taskCommands.ts
var statuses = /* @__PURE__ */ new Set(["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"]);
var priorities = ["low", "medium", "high", "urgent"];
var severities = ["low", "medium", "high", "very_high"];
var stages = [
  "planning",
  "execution",
  "check",
  "sales",
  "requirements",
  "design",
  "development",
  "testing",
  "deployment",
  "acceptance"
];
var repeatRules = ["none", "daily", "weekly", "interval", "weekdays", "monthly", "after_completion"];
var taskStatus = (value) => {
  if (!statuses.has(value)) throw new Error(`Invalid task status: ${value}`);
  return value;
};
function registerTaskCommands(program2, runtime) {
  const task = program2.command("task").description("\u4EFB\u52A1\u64CD\u4F5C");
  task.command("list").option("--project <project>").option("--status <status>").option("--assignee <member>").option("--query <query>").option("--include-archived").option("--include-split").action(async (options) => {
    const client = runtime.client();
    const projectId = options.project ? await resolveProjectId(client, options.project) : void 0;
    runtime.output(await client.listTasks({
      projectId,
      status: options.status ? options.status === "all" ? "all" : taskStatus(options.status) : void 0,
      assigneeMemberId: options.assignee ? await resolveMemberId(client, options.assignee, projectId) : void 0,
      query: options.query,
      includeArchived: Boolean(options.includeArchived),
      includeSplit: Boolean(options.includeSplit)
    }));
  });
  task.command("show <task>").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.getTask(await resolveTaskId(client, taskRef)));
  });
  task.command("create <project>").requiredOption("--title <title>").option("--notes <notes>").option("--tags <tags>").option("--priority <priority>").option("--severity <severity>").option("--stage <stage>").option("--estimate-hours <hours>").option("--estimate-pomodoros <count>").option("--executor <member>").option("--collaborators <members>").option("--expected-start <iso>").option("--expected-finish <iso>").option("--due <iso>").option("--reminder <iso>").option("--repeat <rule>").option("--repeat-interval-days <days>").option("--subtasks <titles>").action(async (projectRef, options) => {
    const client = runtime.client();
    const projectId = await resolveProjectId(client, projectRef);
    runtime.output(await client.createTask({
      projectId,
      title: options.title,
      notes: options.notes,
      tags: options.tags ? splitList(options.tags) : void 0,
      priority: options.priority ? enumValue(options.priority, "priority", priorities) : void 0,
      severity: options.severity ? enumValue(options.severity, "severity", severities) : void 0,
      stage: options.stage ? enumValue(options.stage, "stage", stages) : void 0,
      estimateHours: options.estimateHours === void 0 ? void 0 : numberValue(options.estimateHours, "estimate-hours", 0),
      estimatePomodoros: options.estimatePomodoros === void 0 ? void 0 : integerValue(options.estimatePomodoros, "estimate-pomodoros", 1),
      primaryExecutorMemberId: options.executor ? await resolveMemberId(client, options.executor, projectId) : void 0,
      collaboratorMemberIds: options.collaborators ? await Promise.all(splitList(options.collaborators).map((ref) => resolveMemberId(client, ref, projectId))) : void 0,
      expectedStartAt: options.expectedStart,
      expectedFinishAt: options.expectedFinish,
      dueAt: options.due,
      reminderAt: options.reminder,
      repeatRule: options.repeat ? enumValue(options.repeat, "repeat", repeatRules) : void 0,
      repeatIntervalDays: options.repeatIntervalDays === void 0 ? void 0 : integerValue(options.repeatIntervalDays, "repeat-interval-days", 1),
      subtasks: options.subtasks ? splitList(options.subtasks) : void 0
    }));
  });
  addDataOption(task.command("create-batch").argument("<project>")).action(async (projectRef, options) => {
    const client = runtime.client();
    runtime.output(await client.batchCreateTasks(
      await resolveProjectId(client, projectRef),
      parseData(options.data)
    ));
  });
  addDataOption(task.command("update").argument("<task>")).action(async (taskRef, options) => {
    const client = runtime.client();
    runtime.output(await client.updateTask(
      await resolveTaskId(client, taskRef),
      parseData(options.data)
    ));
  });
  task.command("delete <task>").requiredOption("--yes", "\u786E\u8BA4\u5220\u9664").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.deleteTask(await resolveTaskId(client, taskRef), true));
  });
  addDataOption(task.command("assign").argument("<task>")).action(async (taskRef, options) => {
    const client = runtime.client();
    runtime.output(await client.assignTask(
      await resolveTaskId(client, taskRef),
      parseData(options.data)
    ));
  });
  addDataOption(task.command("assign-batch").requiredOption("--tasks <tasks>", "\u9017\u53F7\u5206\u9694\u7684\u4EFB\u52A1\u5F15\u7528")).action(async (options) => {
    const client = runtime.client();
    const taskIds = await Promise.all(splitList(options.tasks).map((ref) => resolveTaskId(client, ref)));
    runtime.output(await client.batchAssignTasks(
      taskIds,
      parseData(options.data)
    ));
  });
  task.command("status <task> <status>").option("--yes", "\u786E\u8BA4\u7EC8\u6001\u64CD\u4F5C").action(async (taskRef, status, options) => {
    const client = runtime.client();
    runtime.output(await client.setTaskStatus(await resolveTaskId(client, taskRef), taskStatus(status), Boolean(options.yes)));
  });
  task.command("progress <task> <percent>").option("--note <note>").action(async (taskRef, percent, options) => {
    const client = runtime.client();
    runtime.output(await client.updateTaskProgress(
      await resolveTaskId(client, taskRef),
      numberValue(percent, "percent", 0, 100),
      options.note
    ));
  });
  task.command("split <task>").requiredOption("--data <json-or-file>", "\u5B50\u4EFB\u52A1\u6807\u9898 JSON \u6570\u7EC4\u6216 @path.json").requiredOption("--yes", "\u786E\u8BA4\u62C6\u5206").action(async (taskRef, options) => {
    const client = runtime.client();
    runtime.output(await client.splitTask(
      await resolveTaskId(client, taskRef),
      parseData(options.data),
      true
    ));
  });
}

// cli/src/commands/workflowCommands.ts
function registerWorkflowCommands(program2, runtime) {
  const plan = program2.command("plan").description("\u8BA1\u5212\u548C\u961F\u5217");
  plan.command("show").option("--date <date>").action(async (options) => runtime.output(await runtime.client().getTodayPlan(options.date)));
  plan.command("workbench").option("--project <project>").option("--date <date>").action(async (options) => {
    const client = runtime.client();
    runtime.output(await client.getTodayWorkbench(
      options.project ? await resolveProjectId(client, options.project) : void 0,
      options.date
    ));
  });
  plan.command("add <task>").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.addTaskToToday(await resolveTaskId(client, taskRef)));
  });
  plan.command("add-batch <tasks...>").action(async (taskRefs) => {
    const client = runtime.client();
    runtime.output(await client.batchAddTasksToToday(await Promise.all(taskRefs.map((ref) => resolveTaskId(client, ref)))));
  });
  plan.command("remove <task>").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.removeTaskFromToday(await resolveTaskId(client, taskRef)));
  });
  plan.command("move <task> <direction>").action(async (taskRef, direction) => {
    if (direction !== "up" && direction !== "down") throw new Error("direction must be up or down.");
    const client = runtime.client();
    runtime.output(await client.moveTodayTask(await resolveTaskId(client, taskRef), direction === "up" ? -1 : 1));
  });
  plan.command("schedule <task> <date>").action(async (taskRef, date) => {
    const client = runtime.client();
    runtime.output(await client.scheduleTaskForDate(await resolveTaskId(client, taskRef), date));
  });
  const work = program2.command("work").description("\u6267\u884C\u72B6\u6001");
  work.command("active").option("--project <project>").action(async (options) => {
    const client = runtime.client();
    runtime.output(await client.getActiveWork(options.project ? await resolveProjectId(client, options.project) : void 0));
  });
  work.command("start <task>").action(async (taskRef) => {
    const client = runtime.client();
    runtime.output(await client.startTask(await resolveTaskId(client, taskRef)));
  });
  addDataOption(work.command("pause")).action(async (options) => runtime.output(await runtime.client().pauseWorkSession(
    parseData(options.data)
  )));
  addDataOption(work.command("resume")).action(async (options) => runtime.output(await runtime.client().resumeWorkSession(
    parseData(options.data)
  )));
  addDataOption(work.command("finish")).action(async (options) => runtime.output(await runtime.client().finishWorkSession(
    parseData(options.data)
  )));
  addDataOption(work.command("interrupt")).action(async (options) => runtime.output(await runtime.client().recordInterruption(
    parseData(options.data)
  )));
}

// cli/src/program.ts
function createCliProgram(options = {}) {
  const program2 = new Command();
  program2.name("timemanage").description("TimeManage CLI\uFF1A\u4E00\u6B21\u547D\u4EE4\u4E00\u6B21\u8FDE\u63A5\uFF0C\u4E0D\u542F\u52A8\u5E38\u9A7B\u670D\u52A1\u3002").version("0.2.3").option("--config <path>", "\u914D\u7F6E\u6587\u4EF6\u8DEF\u5F84").option("--server-url <url>", "\u8986\u76D6\u670D\u52A1\u5668\u5730\u5740").option("--email <account>", "\u8986\u76D6\u767B\u5F55\u8D26\u53F7").option("--password <password>", "\u8986\u76D6\u767B\u5F55\u5BC6\u7801").option("--device-id <id>", "\u8986\u76D6\u8BBE\u5907 ID").option("--json", "\u8F93\u51FA\u5B8C\u6574 JSON").showHelpAfterError();
  let client = options.client;
  const runtime = {
    client: () => {
      if (client) return client;
      const flags = program2.opts();
      const env = { ...options.env ?? process.env };
      const overrides = [
        ["config", "TM_CLI_CONFIG"],
        ["serverUrl", "TM_CLI_SERVER_URL"],
        ["email", "TM_CLI_EMAIL"],
        ["password", "TM_CLI_PASSWORD"],
        ["deviceId", "TM_CLI_DEVICE_ID"]
      ];
      for (const [flag, envName] of overrides) {
        if (typeof flags[flag] === "string") env[envName] = flags[flag];
      }
      client = new TimeManageClient(loadConfig(env));
      return client;
    },
    output: (value) => writeResult(options.write ?? ((text) => process.stdout.write(text)), value, Boolean(program2.opts().json))
  };
  program2.command("doctor").description("\u68C0\u67E5\u540E\u53F0\u8FDE\u63A5\u548C\u6570\u636E\u6982\u51B5").action(async () => runtime.output(await runtime.client().getBackendDiagnostics()));
  program2.command("health").description("\u68C0\u67E5\u540E\u53F0\u5065\u5EB7\u72B6\u6001").action(async () => runtime.output(await runtime.client().health()));
  program2.command("search <query>").description("\u641C\u7D22\u9879\u76EE\u3001\u6210\u5458\u548C\u4EFB\u52A1").action(async (query) => runtime.output(await runtime.client().search(query)));
  registerAccountWorkspaceCommands(program2, runtime);
  registerProjectCommands(program2, runtime);
  registerTaskCommands(program2, runtime);
  registerWorkflowCommands(program2, runtime);
  registerReviewConfigCommands(program2, runtime);
  return program2;
}

// cli/src/cli.ts
createCliProgram().parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
