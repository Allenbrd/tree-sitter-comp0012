module.exports = grammar({
	name: "COMP0012Language",

	extras: ($) => [
		$.comment,
		/\s|\\\r?\n/,
	],

	word: ($) => $.identifier,

	conflicts: ($) => [
		[$._primary_expression, $.dialogue_choice],
	],

	rules: {
		source_file: ($) => repeat($._statement),

		// ===================== STATEMENTS =====================

		_statement: ($) =>
			choice(
				$.assignment,
				$.reassignment,
				$.function_definition,
				$.hero_declaration,
				$.enemy_declaration,
				$.item_declaration,
				$.quest_declaration,
				$.encounter_block,
				$.give_statement,
				$.take_statement,
				$.spawn_statement,
				$.strike_statement,
				$.if_statement,
				$.while_statement,
				$.for_in_statement,
				$.return_statement,
				$._expression,
				$.block,
			),

		block: ($) =>
			seq("{", repeat($._statement), "}"),

		// ===================== ENTITY DECLARATIONS =====================

		hero_declaration: ($) =>
			seq(
				"hero",
				field("name", $.string),
				"{",
				optional($.stat_block),
				"}",
			),

		enemy_declaration: ($) =>
			seq(
				"enemy",
				field("name", $.string),
				"{",
				optional($.stat_block),
				"}",
			),

		item_declaration: ($) =>
			seq(
				"item",
				field("name", $.string),
				"{",
				optional($.stat_block),
				"}",
			),

		stat_block: ($) =>
			seq(
				$.stat_entry,
				repeat(seq(",", $.stat_entry)),
				optional(","),
			),

		stat_entry: ($) =>
			seq(
				field("stat", $.identifier),
				":",
				field("value", $._expression),
			),

		// ===================== QUEST & ENCOUNTER =====================

		quest_declaration: ($) =>
			seq(
				"quest",
				field("name", $.string),
				"{",
				repeat(choice($.phase, $._statement)),
				"}",
			),

		phase: ($) =>
			seq(
				"phase",
				field("name", $.string),
				"{",
				repeat($._statement),
				"}",
			),

		encounter_block: ($) =>
			seq(
				"encounter",
				field("name", $.string),
				"{",
				repeat($._statement),
				"}",
			),

		// ===================== INVENTORY OPERATIONS =====================

		give_statement: ($) =>
			seq(
				"give",
				field("item", $._expression),
				"to",
				field("target", $._expression),
			),

		take_statement: ($) =>
			seq(
				"take",
				field("item", $._expression),
				"from",
				field("target", $._expression),
			),

		// ===================== COMBAT =====================

		spawn_statement: ($) =>
			seq(
				"spawn",
				field("name", $.string),
				optional(seq("with", "{", optional($.stat_block), "}")),
			),

		strike_statement: ($) =>
			seq(
				"strike",
				field("target", $._expression),
				"with",
				field("weapon", $._expression),
			),

		// ===================== DIALOGUE TREES =====================

		dialogue: ($) =>
			seq(
				"say",
				field("text", $.string),
				"{",
				repeat($.dialogue_choice),
				"}",
			),

		dialogue_choice: ($) =>
			seq(
				field("option", $.string),
				"=>",
				field("body", choice($._expression, $.block)),
				optional(","),
			),

		// ===================== SKILL CHECKS =====================

		skill_check: ($) =>
			seq(
				"check",
				field("skill", $._expression),
				"vs",
				field("difficulty", $._expression),
				"{",
				$.check_success,
				$.check_failure,
				"}",
			),

		check_success: ($) =>
			seq(
				"success",
				"=>",
				field("body", choice($._expression, $.block)),
				optional(","),
			),

		check_failure: ($) =>
			seq(
				"failure",
				"=>",
				field("body", choice($._expression, $.block)),
				optional(","),
			),

		// ===================== CONTROL FLOW =====================

		if_statement: ($) =>
			seq(
				"if",
				field("condition", $._expression),
				field("consequence", $.block),
				optional(seq(
					"else",
					field("alternative", choice($.if_statement, $.block)),
				)),
			),

		while_statement: ($) =>
			seq(
				"while",
				field("condition", $._expression),
				field("body", $.block),
			),

		for_in_statement: ($) =>
			seq(
				"for",
				field("iterator", $.identifier),
				"in",
				field("iterable", $._expression),
				field("body", $.block),
			),

		return_statement: ($) =>
			prec.right(seq("return", optional(field("value", $._expression)))),

		// ===================== FUNCTION DEFINITIONS =====================

		function_definition: ($) =>
			seq(
				"fn",
				field("name", $.identifier),
				$.parameter_list,
				field("body", $.block),
			),

		// ===================== VARIABLES =====================

		assignment: ($) =>
			seq("var", field("name", $.identifier), "=", field("value", $._expression)),

		reassignment: ($) =>
			seq(field("target", $.identifier), "=", field("value", $._expression)),

		// ===================== EXPRESSIONS =====================

		_expression: ($) =>
			choice(
				$._primary_expression,
				$.binary_expression,
				$.unary_expression,
				$.has_expression,
				$.lambda_expression,
				$.dialogue,
				$.skill_check,
			),

		_primary_expression: ($) =>
			choice(
				$._value,
				$.identifier,
				$.grouped_expression,
				$.array_expression,
				$.index_expression,
				$.slice_expression,
				$.method_call,
				$.function_call,
			),

		grouped_expression: ($) =>
			seq("(", $._expression, ")"),

		// --- Binary Expressions with Precedence ---

		binary_expression: ($) =>
			choice(
				// Logical OR (lowest)
				prec.left(1, seq(
					field("left", $._expression),
					field("operator", "or"),
					field("right", $._expression),
				)),
				// Logical AND
				prec.left(2, seq(
					field("left", $._expression),
					field("operator", "and"),
					field("right", $._expression),
				)),
				// Equality
				prec.left(3, seq(
					field("left", $._expression),
					field("operator", choice("==", "!=")),
					field("right", $._expression),
				)),
				// Comparison
				prec.left(4, seq(
					field("left", $._expression),
					field("operator", choice("<", ">", "<=", ">=")),
					field("right", $._expression),
				)),
				// Range (for iteration)
				prec.left(5, seq(
					field("left", $._expression),
					field("operator", ".."),
					field("right", $._expression),
				)),
				// Addition / Subtraction
				prec.left(6, seq(
					field("left", $._expression),
					field("operator", choice("+", "-")),
					field("right", $._expression),
				)),
				// Multiplication / Division / Modulo
				prec.left(7, seq(
					field("left", $._expression),
					field("operator", choice("*", "/", "%")),
					field("right", $._expression),
				)),
			),

		// --- Unary ---

		unary_expression: ($) =>
			prec(8, seq(
				field("operator", choice("-", "not")),
				field("operand", $._expression),
			)),

		// --- Has expression (inventory check) ---

		has_expression: ($) =>
			prec.left(3, seq(
				field("owner", $._expression),
				"has",
				field("item", $._expression),
			)),

		// --- Lambda Expressions ---

		lambda_expression: ($) =>
			choice(
				seq("fn", $.parameter_list, $.block),
				prec.right(-1, seq("fn", $.parameter_list, "=>", $._expression)),
			),

		parameter_list: ($) =>
			seq("(", optional(seq(
				$.identifier,
				repeat(seq(",", $.identifier)),
			)), ")"),

		// --- Function / Method Calls ---

		function_call: ($) =>
			prec(9, seq(
				field("function", $.identifier),
				$.argument_list,
			)),

		method_call: ($) =>
			prec(9, seq(
				field("receiver", choice($.identifier, $.method_call)),
				".",
				field("name", $.identifier),
				$.argument_list,
			)),

		argument_list: ($) =>
			seq("(", optional(seq(
				$._expression,
				repeat(seq(",", $._expression)),
			)), ")"),

		// --- Arrays ---

		array_expression: ($) =>
			seq("[", optional(seq(
				$._expression,
				repeat(seq(",", $._expression)),
			)), "]"),

		index_expression: ($) =>
			prec(10, seq(
				field("object", choice($.identifier, $.method_call, $.index_expression, $.slice_expression, $.function_call)),
				"[",
				field("index", $._expression),
				"]",
			)),

		slice_expression: ($) =>
			prec(10, seq(
				field("object", choice($.identifier, $.method_call, $.index_expression, $.slice_expression, $.function_call)),
				"[",
				optional(field("start", $._expression)),
				"..",
				optional(field("end", $._expression)),
				"]",
			)),

		// ===================== TERMINALS =====================

		_value: ($) =>
			choice(
				$.bool,
				$.dice,
				$.num,
				$.string,
			),

		identifier: (_$) => /[A-Za-z_][A-Za-z0-9_]*/,
		bool: (_$) => choice("true", "false"),
		dice: (_$) => /[0-9]+d[0-9]+/,
		num: (_$) => /[0-9]+(\.[0-9]+)?/,
		string: (_$) => seq('"', /[^"]*/, '"'),

		comment: (_$) =>
			token(choice(
				seq("//", /(\\(.|\r?\n)|[^\\\n])*/),
				seq(
					"/*",
					/[^*]*\*+([^/*][^*]*\*+)*/,
					"/",
				),
			)),
	},
});
