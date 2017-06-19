/*
 *
 */

Query
    = "[" _ fs:FindSpec ic:WithClause ins:Inputs hc:WhereClauses _ "]"
        { return { find_spec:fs, with_clause:ic, inputs:ins, where_clauses:hc };  }

FindSpec
    = ":find" _ l:FindElemList
        { return { find_type:'relation', elems:l }; }
    / ":find" _ "[" _ e:FindElem _ "..." _ "]"
        { return { find_type:'collection', elem: e }; }
    / ":find" _ "[" _ l:FindElemList _ "]"
        { return { find_type:'tuple', elems: l }; }
    / ":find" _ e:FindElem _ "."
        { return { find_type:'scalar', elem: e }; }

WithClause
    = ( __ ":with" __ l:VariableList { return l; } )?

Inputs
    = ( __ ":in"   __ l:InputList    { return l; } )?

WhereClauses
    = ( __ ":where" _ l:ClauseList   { return l; } )?

FindElemList
    = e:FindElem __ l:FindElemList { l.unshift( e ); return l; }
    / e:FindElem                   { return [ e ]; }

FindElem
    = v:Variable
        { return { elem_type:'var', var:v }; }
    / "[" _ "pull" __ v:Variable __ p:Pattern _ "]"
        { return { elem_type:'pull', var:v, pattern:p }; }
    / "[" _ n:"id" __ l:FnArgList _ "]"
        { return { elem_type:'aggregate', name:n, args:l }; }

Pattern
    = i:InputName          { return i; }
    / p:PatternDataLiteral { return p; }

InputName
    = "I Don't Know" { return 42; }

PatternDataLiteral
    = "I Don't Know" { return 42; }

FnArgList
    = a:FnArg __ l:FnArgList { l.unshift( a ); return l; }
    / a:FnArg                { return [ a ]; }

FnArg
    = v:Variable { return { arg_type:'variable', var:v }; }
    / c:Constant { return { arg_type:'constant', const:c }; }
    / s:SrcVar   { return { arg_type:'srcvar',   var:s }; }

VariableList
    = v:Variable __ l:VariableList  { l.unshift( v ); return l; }
    / v:Variable                    { return [ v ]; }

InputList
    = i:Input __ l:InputList  { l.unshift( i ); return l; }
    / i:Input                 { return [ i ]; }

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
    = c:Clause __ l:ClauseList  { l.unshift( c ); return l; }
    / c:Clause                  { return [ c ]; }

Clause
    = "[" _ sv:( SrcVar __ )? "not" __ l:ClauseList _ "]"
        { return { clause_type:'not', srcvar: sv, l }; }
    / "[" _ sv:( SrcVar __ )? "not-join" _ "[" _ vs:VariableList _ "]" _ cs:ClauseList _ "]"
        { return { clause_type:'not-join', srcvar:sv, vars:vs, clauses:cs }; }
    / "[" _ sv:( SrcVar __ )? "or" __ cs:ClauseAndClauseList _ "]"
        { return { clause_type:'or', srcvar:sv, clauses:cs }; }
    / "[" _ sv:( SrcVar __ )? "or-join" _ vs:RuleVars _ cs:ClauseAndClauseList _ "]"
        { return { clause_type:'or-join', vars:vs, clauses:cs }; }
    / "[" _ sv:( SrcVar __ )? rs:RuleArgList _ "]"
        { return { clause_type:'data-pattern', srcvar: sv, rules: l }; }
    / "[" _ "[" _ n:Symbol __ as:FnArgList _ "]" _ "]"
        { return { clause_type:'pred-expr', name:n, args:as }; }
    / "[" _ "[" _ n:Symbol __ as:FnArgList _ "]" _ b:Binding _ "]"
        { return { clause_type:'fn-expr', args:as, binding:b }; }
    / "[" _ sv:( SrcVar __ )? n:RuleName __ as:RuleArgList _ "]"
        { return { clause_type:'rule-expr', name:n, args:as }; }

RuleName
    = Symbol {} // ???

RuleVars
    = "[" _ VariableList _ "]"                      {}
    / "[" _ "[" _ VariableList _ "]" _ "]"              {}
    / "[" _ "[" _ VariableList _ "]" _ VariableList _ "]" {}

ClauseAndClauseList
    = ClauseAndClause __ ClauseAndClauseList {}
    / ClauseAndClause                     {}

ClauseAndClause
    = Clause    {}
    / AndClause {}

AndClause
    = "[" _ "and" _ ClauseList _ "]" {}

RuleArgList
    = r:RuleArg __ l:RuleArgList { l.unshift( r ); return l; }
    / r:RuleArg                  { return [ r ]; }

RuleArg
    = Variable { return 42; }
    / Constant { return 43; }
    / "_"      { return 44; }

Binding
    = Variable
   / "[" BindingList "]"
   / "[" Variable _ "..." _ "]"
   / "[" _ "[" BindingList "]" "]"

BindingList
    = BindingElem BindingList
    / BindingElem

BindingElem
    = Variable {}
    / "_"      {}

Variable
    = "?" sym:Symbol  { return sym; }

SrcVar
    = "$" sym:Symbol  { return sym; }

Name
    = n:([a-zA-Z][a-zA-Z0-9_\-]*)  { return n; }

Symbol
    = ( ( Name ( "." Name )* ) "/")? Name

// FIX
Constant
    = ":" sym:Symbol     { return keyword( ':'+sym ); }
    / '"' s:([^"]*) '"'  { return s; }
    / "true"             { return true; }
    / "false"            { return false; }
    / num:([1-9][0-9]*)  { return num; /* XXX */ }
    / "4.2"              { return 4.2; /* XXX */ }

// optional whitespace
_  = [ \t\r\n]*

// mandatory whitespace
__ = [ \t\r\n]+
