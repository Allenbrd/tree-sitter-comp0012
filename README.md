# QuestScript: An RPG Scripting Language

## Motivation

Tabletop RPGs are, at their core, a programming problem: a game master tracks stat blocks, manages inventories, resolves dice-based skill checks and navigates branching dialogue. Existing scripting languages like Lua treat all of these as library concerns, requiring the designer to encode `roll(2, 6) + 3` where a tabletop player would write `2d6 + 3`.

QuestScript makes these RPG activities first-class syntactic constructs: entity declarations with stat blocks, dice expressions, array slicing, inventory operations, branching dialogue, skill checks and lambda expressions. These interact with a full expression system (seven precedence levels), function definitions and standard control flow, while exercising the LR, LALR and GLR parsing concepts covered in the module.

## Implementation

### Dice Expressions

Dice are a custom terminal matched by `/[0-9]+d[0-9]+/`, tokenising strings like `2d6` as single lexemes. This creates a lexer conflict: `2d6` could be scanned as `num(2)` followed by `identifier(d6)`. Tree-sitter resolves this via maximal munch: `dice` is a longer match, so the lexer prefers it. Dice then participate in the full precedence system:

```
2d6 + 3 > 15    // parses as: (2d6 + 3) > 15
```

### Operator Precedence and Shift-Reduce Conflicts

I added seven binary precedence levels, from `or` (1) through `*`/`/`/`%` (7), plus unary `not`/`-` (8). Each uses `prec.left()` for left-associativity. These resolve shift-reduce conflicts in the LR parser:

```
1 + 2 * 3       // * has prec 7 vs + at 6, so parser shifts: 1 + (2 * 3)
not a and b      // not has prec 8, binds tighter: (not a) and b
```

The `has` keyword is an infix boolean at precedence 3 (same as `==`/`!=`), so `and` at level 2 binds looser:

```
player has "sword" and player has "shield"
// parses as: (player has "sword") and (player has "shield")
```

### Entity Declarations with Stat Blocks

Stat blocks are comma-separated `identifier : expression` pairs where values are full expressions:

```
hero "Gandalf" { hp: 100, attack: 3d6 + 2, mana: 50 }
// attack: 3d6 + 2 is ONE stat entry, not two
// the comma delimiter and precedence ensure + is consumed before reducing
```

### Dialogue Trees

`say` introduces branching choices where each string maps to a body via `=>`:

```
say "Who goes there?" {
  "Friend" => greet(),        // string as dialogue choice pattern
  "Foe" => strike(guard),
}
```

The parsing challenge: strings appear both as expressions and dialogue choice patterns. When the parser sees a string inside a `say` block, it cannot decide which rule applies. I resolve this with a `conflicts` declaration on `_primary_expression` and `dialogue_choice`, triggering GLR: the parser explores both alternatives in parallel and commits once it sees (or does not see) the `=>`.

### Skill Checks

A structured conditional with two mandatory arms, enforced syntactically:

```
check wisdom vs 15 {
  success => print("You sense a trap"),
  failure => print("You walk into it"),
}
// omitting either arm is a parse error (negative tests confirm this)
```

### Lambda Expressions

Two forms: block and arrow. The arrow form uses `prec.right(-1)` for greedy body capture:

```
fn(x, y) { x + y }          // block form
fn(x) => x * 2 + 1          // arrow: entire x * 2 + 1 is the body
var f = fn(x) => x * 2      // composes with assignment
```

The `prec.right(-1)` creates a shift-reduce conflict resolved in favour of shifting, the same right-associativity trick Haskell uses for lambda abstractions.

### Array Slicing

Slicing supports omitting either bound:

```
loot[1..3]                   // subarray extraction
arr[..3]                     // from start
arr[2..]                     // to end
loot[1..3][0]                // slice then index
```

Both `index_expression` and `slice_expression` begin with `object[expr`, so the parser cannot decide which rule applies until it sees `..` (slice) or `]` (index). Both use `prec(10)` and tree-sitter resolves the ambiguity by exploring both parses.

### Function Definitions

```
fn roll_attack(bonus) { return 2d6 + bonus }
```

The `fn` keyword is shared with lambdas, but the parser distinguishes them structurally: a definition has a name identifier between `fn` and the parameter list, while a lambda does not. This is a one-token lookahead distinction the LR parser resolves without a conflict declaration.

### Inventory and Combat

`give "sword" to player` and `take "key" from chest` use `to` and `from` as keyword delimiters. These keywords are contextual: `to`, `from` and `with` are valid identifiers elsewhere. Tree-sitter's `word` mechanism ensures keyword rules take precedence in the correct position.

## Test Suite

181 tests (124 positive, 57 negative) covering every grammar rule, every operator at every precedence level, boundary violations for each construct and feature interactions like dialogue branching into skill checks.
