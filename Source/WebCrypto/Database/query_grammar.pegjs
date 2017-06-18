/*
 *
 */

Query
    = "[" _ FindSpec WithClause Inputs WhereClauses _ "]" {}

FindSpec
    = ":find" _ FindElemList                 {}
    / ":find" _ "[" _ FindElem _ "..." _ "]" {}
    / ":find" _ "[" _ FindElemList _ "]"     {}
    / ":find" _ FindElem _ "."               {}

WithClause
    = ( __ ":with" _ VariableList )? {}

Inputs
    = ( __ ":in" _ InputList )? {}

WhereClauses
    = ( __ ":where" _ ClauseList )? {}

FindElemList
    = e:FindElem                   { return [ e ]; }
    / e:FindElem __ l:FindElemList { l.unshift( e ); return l; }

FindElem
    = Variable                                  {}
    / "[" _ "pull" __ Variable __ Pattern _ "]" {}
    / "[" _ "id" __ FnArgList _ "]"             {}

Pattern
    = InputName          {}
    / PatternDataLiteral {}

InputName
    = "I Don't Know" {}

PatternDataLiteral
    = "I Don't Know" {}

FnArgList
    = a:FnArg                { return [ a ]; }
    / a:FnArg __ l:FnArgList { l.unshift( a ); return l; }

FnArg
    = Variable {}
    / Constant {}
    / SrcVar   {}

VariableList
    = v:Variable                    { return [ v ]; }
    / v:Variable __ l:VariableList  { l.unshift( v ); return l; }

InputList
    = i:Input                 { return [ i ]; }
    / i:Input __ l:InputList  { l.unshift( i ); return l; }

Input
    = SrcVar     {}
    / Variable   {}
    / PatternVar {}
    / RulesVar   {}

RulesVar
    = "%" {} // ???

PatternVar
    = Symbol {} // "plain symbol"?

ClauseList
    = c:Clause                  { return [ c ]; }
    / c:Clause __ l:ClauseList  { l.unshift( c ); return l; }

Clause
    = "[" _ ( SrcVar __ )? "not" _ ClauseList "]"        {}
    / "[" SrcVar? "not-join" "[" VariableList "]" ClauseList "]"    {}
    / "[" SrcVar? "or" ClauseAndClauseList "]"         {}
    / "[" SrcVar? "or-join" RuleVars ClauseAndClauseList "]"     {}
    / "[" SrcVar? RuleArgList "]"
    / "[" "[" "id" FnArgList "]" "]"
    / "[" "[" "id" FnArgList "]" Binding "]"
    / "[" SrcVar? RuleName RuleArgList "]"

RuleName
    = Symbol {} // ???

RuleVars
    = "[" VariableList "]"                      {}
    / "[" "[" VariableList "]" "]"              {}
    / "[" "[" VariableList "]" VariableList "]" {}

ClauseAndClauseList
    = ClauseAndClause                     {}
    / ClauseAndClause ClauseAndClauseList {}

ClauseAndClause
    = Clause    {}
    / AndClause {}

AndClause
    = "[" "and" ClauseList "]" {}

RuleArgList
    = RuleArg             {}
    / RuleArg RuleArgList {}

RuleArg
    = Variable {}
    / Constant {}
    / "_"      {}

Binding
    = Variable
   / "[" BindingList "]"
   / "[" Variable _ "..." _ "]"
   / "[" _ "[" BindingList "]" "]"

BindingList
    = BindingElem
    / BindingElem BindingList

BindingElem
    = Variable {}
    / "_"      {}

Variable
    = "?" sym:Symbol  { return sym; }

SrcVar
    = "$" sym:Symbol  { return sym; }

Symbol
    = sym:([a-zA-Z][a-zA-Z0-9_\-]*)  { return sym; }

// optional whitespace
_  = [ \t\r\n]*

// mandatory whitespace
__ = [ \t\r\n]+

// FIX
Constant
    = ":" sym:Symbol     { return keyword( ':'+sym; ) }
    / '"' s:([^"]*) '"'  { return s; }
    / "true"             { return true; }
    / "false"            { return false; }
    / num:([1-9][0-9]*)  { return num; /* XXX */ }
    / "4.2"              { return 4.2; /* XXX */ }

