# QuestScript: An RPG Scripting Language

## Motivation

Tabletop RPGs are, at their core, a programming problem: a game master tracks stat blocks, manages inventories, resolves dice-based skill checks and navigates branching dialogue. Existing game scripting languages like Lua treat all of these as library concerns, requiring the designer to encode `roll(2, 6) + 3` where a tabletop player would simply write `2d6 + 3`.

QuestScript makes seven RPG activities first-class syntactic constructs: entity declarations with stat blocks, dice expressions, array slicing, inventory operations, branching dialogue, skill checks and lambda expressions. These interact with a full expression system (seven precedence levels, logical and arithmetic operators), function definitions and standard control flow. The result is a language where a quest definition reads like a game script rather than a general-purpose program, while still exercising the LR, LALR and GLR parsing concepts covered in the module.

## Implementation

### Dice Expressions

Dice are a custom terminal matched by `/[0-9]+d[0-9]+/`, tokenising strings like `2d6` and `1d20` as single lexemes. This creates a lexer conflict: `2d6` could also be scanned as `num(2)` followed by `identifier(d6)`. Tree-sitter resolves this via maximal munch: since `dice` is a longer match than `num` alone, the lexer prefers it. Once tokenised, dice participate in the full expression grammar, so `2d6 + 3 > 15` parses as `(2d6 + 3) > 15`.

### Operator Precedence and Shift-Reduce Conflicts

The base Wren grammar has no operators. I added seven binary precedence levels, from `or` (1) through `*`/`/`/`%` (7), plus unary `not`/`-` (8). Each level uses `prec.left()` to encode left-associativity. These declarations directly resolve shift-reduce conflicts in the LR parser: when the parser has `1 + 2` on the stack and sees `*`, the higher precedence of `*` (7 vs. 6) causes a shift rather than a reduce, producing `1 + (2 * 3)`.

The `has` keyword is an infix boolean operator (`player has "shield"`) at precedence 3, the same level as `==`/`!=`. So `player has "sword" and player has "shield"` parses as `(player has "sword") and (player has "shield")`, since `and` at level 2 binds looser.

### Entity Declarations with Stat Blocks

`hero "Gandalf" { hp: 100, attack: 3d6 + 2, mana: 50 }` declares a named entity with structured stats. The stat block is a comma-separated list of `identifier : expression` pairs with optional trailing commas. Stat values are full expressions, so `attack: 3d6 + 2` must be parsed as a single stat entry with value `3d6 + 2`, not as two entries. The comma delimiter and precedence system ensure the `+` is consumed as part of the expression before the parser reduces the stat entry.

### Dialogue Trees

`say` introduces branching choices: `say "Who goes there?" { "Friend" => greet(), "Foe" => strike(guard) }`. Each choice maps a string to a body via `=>`. The parsing challenge is that strings appear both as ordinary expressions and as dialogue choice patterns. When the parser sees `"string"` inside a `say` block, it cannot decide whether this begins a dialogue choice or a standalone expression. I resolve this with tree-sitter's `conflicts` declaration on `_primary_expression` and `dialogue_choice`, triggering GLR parsing: the parser explores both alternatives in parallel and commits once it sees (or does not see) the `=>` arrow.

### Skill Checks

`check wisdom vs 15 { success => ..., failure => ... }` is a structured conditional with two mandatory arms. The `vs` keyword separates two arbitrary expressions. The two-arm structure is enforced syntactically: `skill_check` requires both `check_success` and `check_failure` children in order. Programs that omit either arm are rejected at parse time; the negative tests confirm this.

### Lambda Expressions

Lambdas come in two forms: block (`fn(x, y) { x + y }`) and arrow (`fn(x) => x + 1`). The arrow form uses `prec.right(-1)` so the body extends as far right as possible: `fn(x) => x + 1` parses the entire `x + 1` as the body rather than just `x`. This is the same right-associativity trick that Haskell uses for lambda abstractions. It creates a shift-reduce conflict that `prec.right` resolves in favour of shifting. Lambdas are expressions, so they compose with assignment (`var f = fn(x) => x * 2`) and can be passed as arguments.

### Array Slicing

`loot[1..3]` extracts a subarray using the range operator `..` inside brackets. Slicing supports omitting either bound: `arr[..3]` slices from the start, `arr[2..]` slices to the end. The parsing challenge is disambiguating slices from ordinary indexing. Both `index_expression` and `slice_expression` begin with `object [` followed by an expression, so the parser cannot decide which rule applies until it sees `..` (slice) or `]` (index). Both rules use `prec(10)` and tree-sitter resolves the ambiguity by exploring both parses. Slicing composes with indexing: `loot[1..3][0]` parses as indexing into the result of a slice, since both rules appear in each other's `object` field.

### Function Definitions

`fn roll_attack(bonus) { return 2d6 + bonus }` defines a named function. The `fn` keyword is shared with lambda expressions, but the parser distinguishes them structurally: a function definition requires a name identifier between `fn` and the parameter list, while a lambda has no name. This works without an explicit conflict declaration because the presence or absence of the name identifier after `fn` is a one-token lookahead distinction that the LR parser resolves naturally.

### Inventory and Combat

`give "sword" to player` and `take "key" from chest` use `to` and `from` as keyword delimiters. `strike target with 2d6` similarly uses `with`. These keywords are contextual: `to`, `from` and `with` are valid identifiers elsewhere. Tree-sitter's `word` mechanism ensures keyword rules take precedence in the correct position.

## Test Suite

The test suite contains 181 tests (124 positive, 57 negative) covering every grammar rule, every operator at every precedence level, boundary violations for each construct and feature interactions like dialogue branching into skill checks.
