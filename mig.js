var antlr4 = require("antlr4");
var AS3Lexer = require("./AS3Lexer").AS3Lexer;
var AS3Parser = require("./AS3Parser").AS3Parser;
var AS3Listener = require("./AS3Listener").AS3Listener;
var fs = require("fs");
var path = require("path");
var methodComments = '';
var count = 1;
var resultEvent=""
const inBuiltMethods = JSON.parse(
  fs.readFileSync('./ActionScript/InBuiltMethods.json', {
    encoding: 'utf8'
  })
);
var {
  handleMxButtonASAttributes,
} = require("../tagTemplates/mxButton/index.js");

var {
  getOriginalText,
  utilSplit,
  saveContexts,
  migratorLog,
} = require("../utilities");

var { handleMxLabelASAttributes } = require("../tagTemplates/label/index.js");

var {
  handleMxAdvanceDataGridASAttributes,
} = require("../tagTemplates/mxAdvancedDataGrid/index.js");

var {
  handleMxDataGridASAttributes,
} = require("../tagTemplates/mxDataGrid/index.js");

var {
  handleMxComboBoxASAttributes,
} = require("../tagTemplates/mxComboBox/index.js");

var { handleMxVRuleASAttributes } = require("../tagTemplates/mxVRule/index.js");

var {
  handleMxTextAreaASAttributes,
} = require("../tagTemplates/mxTextarea/index.js");

var {
  handleMxTextInputASAttributes,
} = require("../tagTemplates/mxTextInput/index.js");

var {
  handleMxHTTPServiceASAttributes,
} = require("../tagTemplates/mxHTTPService/index.js");

var handleAssExpCalls = 0;
var extendsClass="";
var implementsInterface="";

var { handleMxCheckBoxASAttributes } =require('../tagTemplates/mxCheckBox/index.js');

const Handlebars = require("handlebars");

var variableDataTypeMap = {};
var popupData = {};
var classVariables = [];
var methodNames = [];
let mxmlIdList =[];

module.exports.ASMigrator = ASMigrator = (
  scripts,
  outputDirectory,
  fileName,
  tagName,
  componentName,
  lastFile,
  imports,
  routes,
  componentDeclarations,
  importsComponent,
  variableDeclaration,
  constructorInitialization,
  onInitInitialization,
  methodInitialization,
  isExternalActionScript,
  constructorparameters,
  services,
  runId
) => {
  console.log("\n In AS Migrator");
 
  
  // fs.writeFileSync('script.txt', scripts);
  // scripts = 'private function modifyCart():void {empSkill.text = "";}';
  if (scripts) {
    //console.log("\n Found Scripts from .mxml file");
    var input = scripts;
    var chars = new antlr4.InputStream(input);
    var lexer = new AS3Lexer(chars);
    var tokens = new antlr4.CommonTokenStream(lexer);

    var parser = new AS3Parser(tokens);
    var assignmentExpressionModified = false;
    //console.log("\n Antlr thing completed");

    var typeChange = (type) => {
      switch (type) {
        case "String":
          return "string";
        
        case "uint":
        case "Number":
        case "int":
          return "number";

        case "Boolean":
          return "boolean";

        case 'ListCollectionView':
        case 'ArrayCollection':
        case "Array":
          return "any[]";
        case 'PopUpManager':
          return 'DynamicDialogRef';
        case 'Date':
          return 'Date';
        case 'void':
          return 'void';
        default:
          return "any";
      }
    };
    
    mode = "global";
    ifConditionHandler = "";
    variablesDeclared = [];

    console.log("\n Generating Parse Tree");
    console.time("GenerateParseTree");
    parser.buildParseTrees = true;
    console.log("\n Parse Tree Generated, Time Taken : \n ");
    console.timeEnd("GenerateParseTree");
    let mxmlIds = [];
    if (fs.readFileSync("mxmlIds.json", { encoding: "utf8" })) {
      mxmlIds = JSON.parse(
        fs.readFileSync("mxmlIds.json", { encoding: "utf8" })
      );
      mxmlIds.forEach((ele) => {
        mxmlIdList.push(ele.id);
      });
    }
    classVariables = classVariables.concat(mxmlIdList);
    console.log("\n Before handleStatement");
    const handleStatement = ctx => {
      console.log("\n Inside handleStatement");
      

      if (ctx.forStatement()) return handleForStatement(ctx.forStatement());
      else if (ctx.switchStatement()) {
        migratorLog(
          "Action Script: Swith statement",
          getOriginalText(ctx.switchStatement()),
          handleSwitchStatement(ctx.switchStatement()),
          "Handled",
          runId
        );
        return handleSwitchStatement(ctx.switchStatement());
      } else if (ctx.whileStatement()) {
        return handleWhileStatement(ctx.whileStatement());
      } else if (ctx.ifStatement()) {
        // migratorLog(
        //   "Action Script: if statement" ,
        //   ctx.ifStatement(),
        //   handleIfStatement(ctx.ifStatement()),
        //   "Handled",
        //   runId
        // );
        return handleIfStatement(ctx.ifStatement());
      } else if (ctx.forEachStatement()) {
        // migratorLog(
        //   "Action Script: for statement" ,
        //   getOriginalText(ctx.forEachStatement()),
        //   handleIfStatement(ctx.forEachStatement()),
        //   "Handled",
        //   runId
        // );
        return handleForEachStatement(ctx.forEachStatement());
      } else if (ctx.declarationStatement()) {
        
        let declarationStatement = "";
        let declarationCtx = ctx.declarationStatement().declaration();

        declarationStatement =
          declarationStatement + declarationCtx.varOrConst().getText() + " ";

        let initialization = "";
        let declaration = true;

        child = declarationCtx.variableDeclarator();

        if (child.typeExpression() && child.typeExpression().identifier()) {
          let type = '';
          if(child.getText().includes('PopUpManager.createPopUp')){
            type = typeChange('PopUpManager');
          }
          else{
            type = typeChange(child.typeExpression().identifier().getText());
          }
          
          declarationStatement =
            declarationStatement + child.ident().getText() + ": " + type;

        }

        // Moved below code to the if block above.
        // declarationStatement =
        //   declarationStatement + child.ident().getText() + ": " + type;
        if (child.variableInitializer()) {
          declaration = false;
          if (child.variableInitializer().assignmentExpression())
            // initialization = child
            //     .variableInitializer()
            //     .assignmentExpression().getText();
            initialization = child.variableInitializer();
        }
        if (declaration) {
          declarationStatement = declarationStatement;
        } else {
          // console.log('wooow2', initialization.assignmentExpression().getText(), typeof initialization.assignmentExpression());
          initialization = handleAssignmentExpression(initialization);
          // console.log('woooooooooow', initialization);
          declarationStatement = declarationStatement + ' = ' +  initialization ;
        }
        //Inside method variable declarations
        let statementSplit = declarationStatement.split("=")[0].trim();
        if(statementSplit.endsWith("var")){
          declarationStatement = declarationStatement.split("=")[0].trim() + " " +declarationCtx.variableDeclarator().ident().getText()+" = "+declarationStatement.split("=")[1].trim();
        }

        //for getter and setters 
        if(declarationStatement.trim().startsWith("const") && declarationStatement.includes("propertyChangeEvent"))
            declarationStatement="//"+declarationStatement;

        return declarationStatement;
      } else if (ctx.expressionStatement()) {
        if(ctx.expressionStatement().getText().includes("parentApplication."))
          return "//"+getOriginalText(ctx.expressionStatement())

        // Calling handleAssignmentExpression to process Assignment Expressions, Passing expressionList context as a parameter.
        assignmentExpressionModified = false;
        let expression = '';
        for(exp of ctx.expressionStatement().expressionList().assignmentExpression()){
          expression +=  handleAssignmentExpression(exp);
        }
        // handleAssignmentExpression() should return updated expression, if not then we will write the initial context as is.
        if(expression === undefined){
          return "";
        }
        if (expression) {
          if (assignmentExpressionModified) {
            if (expression.trim().endsWith("="))
              expression = expression.substr(0, expression.length - 2);
		
	          if(expression.trim().charAt(expression.trim().length-1).toString()!=";") {
              expression+=";";
            }
            return expression;
          } else {
            expLeft = getOriginalText(ctx).split("=")[
              getOriginalText(ctx).split("=").length - 1
            ];
            if (expLeft.length < 0) {
              expLeft = '""';
            }
            if(expression.trim().endsWith('=')){
              return expression + expLeft;
            }
            else{
              if(expression.trim().endsWith(';')){
                return expression;
              }
              return expression + ';';
            }
            // if(expression.includes(expLeft.trim().substr(0,expLeft.length - 2))) {
            //   if(expression.trim().charAt(expression.trim().length-1).toString()!=";") {
            //     expression+=";";
            //   }
            //   return expression;
            // }
            // else return expression + expLeft;

            }
          }
        if(ctx.expressionStatement().getText().trim().startsWith("dispatchEvent")   )
          return "//"+ getOriginalText(ctx);

        return getOriginalText(ctx);
      } else if (ctx.breakStatement()) {
        return ctx.breakStatement().getText();
      } else if(ctx.tryStatement()){
        
        return handleTryStatement(ctx.tryStatement());

     }
      
      else if (ctx.returnStatement()){
        
        /* ct=ctx.returnStatement().expression().assignmentExpression();
        var ctxArray = new Array();
      
        ctxArray.push(ct);
        ct.array=ctxArray;
        st=handleAssignmentExpression(ct); */



        return getOriginalText(ctx.returnStatement())
      } 
      else {
        return "//" + getOriginalText(ctx);
      }
    };
    
	//console.log("\n After handleStatement");
	
	//console.log("\n Before handleAssignmentExpression");	
    const handleAssignmentExpression = ctx => { 
      //To handle assignmentExpression, condition, expressionList, conditionalExpression
      ++handleAssExpCalls;
		  console.log("\n Inside handleAssignmentExpression", handleAssExpCalls,getOriginalText(ctx));
      let expression = "";
      let initialization = '';
      try{
        initialization = getOriginalText(ctx.conditionalExpression());
      }
      catch(e){
        if(ctx.assignmentExpression() !== undefined && !Array.isArray(ctx.assignmentExpression())){
          initialization = getOriginalText(ctx.assignmentExpression());
        }
        else{
          initialization = getOriginalText(ctx);
        }
      }
      
      let arrColRe = /new[\s]*ArrayCollection[\s]*[(]/g;
      let initArray1;
      let match;
      // initArray1 = Array.from(initialization.matchAll(arrColRe));
      initArray1 = [];
      do {
        match = arrColRe.exec(initialization);
        if (match) {
          initArray1.push(match);
        }
      } while (match);
      while (initArray1.length>0){
        match = initArray1[0];
        initialization = initialization.substring(0, match.index) + '[' + initialization.substring(match.index + match[0].length);
        initialization = initialization.substring(0, initialization.lastIndexOf(')')) 
        + ']' 
        + initialization.substring(initialization.lastIndexOf(')') + 1);
        // initArray1 = Array.from(initialization.matchAll(arrColRe));
        initArray1 = [];
        do {
          match = arrColRe.exec(initialization);
          if (match) {
            initArray1.push(match);
          }
        } while (match);
      }
      let arrRe = /new[\s]*Array[\s]*[(]/g;
      // initArray1 = Array.from(initialization.matchAll(arrRe));
      initArray1 = [];
      do {
        match = arrRe.exec(initialization);
        if (match) {
          initArray1.push(match);
        }
      } while (match);
      while (initArray1.length>0){
        match = initArray1[0];
        initialization = initialization.substring(0, match.index) + '[' + initialization.substring(match.index + match[0].length);
        initialization = initialization.substring(0, initialization.lastIndexOf(')')) 
        + ']' 
        + initialization.substring(initialization.lastIndexOf(')') + 1);
        // initArray1 = Array.from(initialization.matchAll(arrRe));
        initArray1 = [];
        do {
          match = arrRe.exec(initialization);
          if (match) {
            initArray1.push(match);
          }
        } while (match);
      }
      let grpColRe = /new[\s]*GroupingCollection[\s]*[(][\s]*[)]/g;
      // initArray1 = Array.from(initialization.matchAll(grpColRe));
      initArray1 = [];
      do {
        match = grpColRe.exec(initialization);
        if (match) {
          initArray1.push(match);
        }
      } while (match);
      while (initArray1.length>0){
        match = initArray1[0];
        initialization = initialization.substring(0, match.index) + '{}' + initialization.substring(match.index + match[0].length);
        // initArray1 = Array.from(initialization.matchAll(grpColRe));
        initArray1 = [];
        do {
          match = grpColRe.exec(initialization);
          if (match) {
            initArray1.push(match);
          }
        } while (match);
      }      
      let ctxArray = initialization.split(' ');
      if(ctxArray.includes('as')){
        let type = typeChange(ctxArray[ctxArray.indexOf('as') + 1].replace(/[^a-zA-Z]/g, ""));
        type = ctxArray[ctxArray.indexOf('as') + 1]
              .replace(ctxArray[ctxArray.indexOf('as') + 1]
              .replace(/[^a-zA-Z]/g, ""), type);
        if(type === 'any'){
          ctxArray.splice(ctxArray.indexOf('as'),2);
        }
        else{
          ctxArray[ctxArray.indexOf('as') + 1] = type;
        }        
      }
      if(ctxArray.includes('is')){
        let index = ctxArray.indexOf('is');
        ctxArray[index] = '===';
        ctxArray[index+1] = typeChange(ctxArray[index+1]);
        ctxArray.splice(index-1, 0, 'typeof');
      }      
      initialization = ctxArray.join(' ');      
      //Removing all 'this.'
      let thisRe = /[^A-Za-z0-9_]?this[.]/g;
      // initArray1 = Array.from(initialization.matchAll(thisRe));
      initArray1 = [];
      do {
        match = thisRe.exec(initialization);
        if (match) {
          initArray1.push(match);
        }
      } while (match);
      while(initArray1.length>0){
        match = initArray1[0];
        if(match[0].startsWith('t')){
          initialization = initialization.substring(0, match.index) + initialization.substring(match.index + match[0].length);
        }
        else{
          initialization = initialization.substring(0, match.index+1) + initialization.substring(match.index + match[0].length);
        }
        // initArray1 = Array.from(initialization.matchAll(thisRe));
        initArray1 = [];
        do {
          match = thisRe.exec(initialization);
          if (match) {
            initArray1.push(match);
          }
        } while (match);
      }
      if(expression ==''){
        expression = initialization;
      }
      //Below logic of re1 and re is to migrate inbuilt methods stored in InBuiltMethods.json file
      let list = Object.keys(variableDataTypeMap);
      let re1 = /[A-Za-z0-9_]+[.][A-Za-z0-9_]+[\s]*[^(]/g; 
      let temp1 = expression;
      let temp2 = '';
      // let size1 = Array.from(expression.matchAll(re1)).length;
      //console.log(assExp, re.exec(assExp));
      // initArray1 = expression.matchAll(re1);
      initArray1 = [];
      do {
        match = re1.exec(expression);
        if (match) {
          initArray1.push(match);
        }
      } while (match);
      let size1 = initArray1.length;
      while(temp1 !=temp2 && size1>0){
        temp1 = expression;
        for(variable1 of initArray1){
          // console.log('regex1', variable1[0]);
          variable1[0] = variable1[0].replace(' ','');
          let id = variable1[0].split('.')[0];
          let replaceStr = '';
          let modVariable1 = variable1[0];
          if(expression.substring(variable1.index + variable1[0].length).trim().startsWith('(')){
            continue;
          }
          if(!modVariable1.substring(modVariable1.length-1).match(/[A-Za-z0-9_]/g)){
            modVariable1 = variable1[0].substring(0,variable1[0].length-1).split('.')[1];
          }
          else{
            modVariable1 = modVariable1.split('.')[1];
          }

          if(list.includes(id) && inBuiltMethods.hasOwnProperty(variableDataTypeMap[id])){
            replaceStr = inBuiltMethods[variableDataTypeMap[id]][modVariable1];
          }
          else{
            replaceStr = inBuiltMethods['Nothing'][modVariable1];
          }
          if( replaceStr != undefined){
            if(replaceStr == ''){
              expression = '/* ' + expression + ' Commented by IMP */';
            }
            else{
              replaceStr = id + '.' + replaceStr;
              expression = expression.substring(0,variable1.index) 
              + replaceStr 
              + expression.substring(variable1.index + variable1[0].length);
            }
            temp2 = expression;
            size1--;
            break;            
          }
        }  
        temp2 = expression;
        // initArray1 = Array.from(expression.matchAll(re1));
        initArray1 = [];
        do {
          match = re1.exec(expression);
          if (match) {
            initArray1.push(match);
          }
        } while (match);
      }
      
      let re = /[A-Za-z0-9_]+[.][A-Za-z0-9_]+[\s]*[(]/g; 
      //console.log(assExp, re.exec(assExp));
      temp1 = expression;
      temp2 = '';
      // initArray1 = expression.matchAll(re);
      initArray1 = [];
        do {
          match = re.exec(expression);
          if (match) {
            initArray1.push(match);
          }
        } while (match);
      // let size = Array.from(expression.matchAll(re)).length;
      size = initArray1.length;
      while(temp1 !== temp2 && size>0){
        temp1 = expression;
        for(variable of initArray1){   
          // console.log('regex1', variable[0]);   
          variable[0] = variable[0].replace(' ','');
          let id = variable[0].split('.')[0];
          let replaceStr = '';
          if(list.includes(id) && inBuiltMethods.hasOwnProperty(variableDataTypeMap[id])){
            replaceStr = inBuiltMethods[variableDataTypeMap[id]][variable[0].substring(0,variable[0].length-1).split('.')[1]];           
          }
          else{
            replaceStr = inBuiltMethods['Nothing'][variable[0].substring(0,variable[0].length-1).split('.')[1]]; 
          }
          if( replaceStr != undefined){
            if(replaceStr == ''){
              expression = '/* ' + expression + ' Commented by IMP */';
            }
            // Need to check for type because it gives issue when the functions in actionscript and functions in javascript are same
            else if(typeof replaceStr !== 'function'){
              switch (variable[0].substring(0,variable[0].length-1).split('.')[1]){
                case 'addItemAt':{
                  let mod = expression.substring(variable.index + variable[0].length-1);
                  mod = mod.substring(1, mod.indexOf(')')).split(',');
                  let modEnd = expression.substring(variable.index + variable[0].length + 
                    expression.substring(variable.index + variable[0].length).indexOf(')') );
                  expression = expression.substring(0,variable.index + variable[0].length )
                  + mod[1] + ',0,' + mod[0]
                  + modEnd;
                  break;
                }
                case 'removeItemAt':{
                  let mod = expression.substring(variable.index + variable[0].length-1);
                  mod = mod.substring(1, mod.indexOf(')'));
                  expression = expression.substring(0,variable.index + variable[0].length +
                    expression.substring(variable.index + variable[0].length).indexOf(')')) + ',1)';
                  break;
                }
              }
              replaceStr = id + '.' + replaceStr;
              expression = expression.substring(0,variable.index) 
              + replaceStr 
              + expression.substring(variable.index + variable[0].length-1);
            }
            temp2 = expression;
            size--;
            break;
          }
        }
        temp2 = expression;
        // initArray1 = expression.matchAll(re);
        initArray1 = [];
        do {
          match = re.exec(expression);
          if (match) {
            initArray1.push(match);
          }
        } while (match);
      }
      //To add 'this.' to global variables
      let clsRe = /[A-Za-z0-9_]+/g;
      // initArray1 = matchAll(expression, clsRe).toArray(); //not working
      // initArray1 = expression.matchAll(clsRe);             // works for nodejs version above 12
      
      let count = [];
      initArray1 = [];
      do {
        match = clsRe.exec(expression);
        if (match) {
          if(classVariables.includes(match[0].split('.')[0]) || methodNames.includes(match[0].split('.')[0])){
            count.push(match[0].split('.')[0]);
          }
          initArray1.push(match);
        }
      } while (match);
      // for(match of initArray1){
      //   if(classVariables.includes(match[0].split('.')[0]) || methodNames.includes(match[0].split('.')[0])){
      //     count.push(match[0].split('.')[0]);
      //   }
      // }
      // initArray1 = Array.from(expression.matchAll(clsRe));
      while(count.length!=0 && initArray1.length>0){
        for(match of initArray1){
          if((classVariables.includes(match[0].split('.')[0]) || methodNames.includes(match[0].split('.')[0]) )
            && count.includes(match[0].split('.')[0])){
            if(expression.substring(0,match.index).endsWith('this.')){
              continue;
            }
            expression = expression.substring(0,match.index) + 'this.' + expression.substring(match.index);
            count.shift();
            break;
          }          
        }
        // initArray1 = Array.from(expression.matchAll(clsRe));
        initArray1 = [];
        do {
          match = clsRe.exec(expression);
          if (match) {
            initArray1.push(match);
          }
        } while (match);
      }
      //To Handle PopUpManager
      if(expression.includes('PopUpManager.createPopUp')){
        expression = expression.replace(' ','');
        let popupName = expression.substring(0,expression.indexOf('('));
        let dynamicDialogTemplateSrc = fs.readFileSync(
          path.join(__dirname, "../templateHelper/dynamicDialog.ts")
        );
        dynamicDialogTemplateSrc = dynamicDialogTemplateSrc.toString();
        let dynamicDialogTemplate = Handlebars.compile(dynamicDialogTemplateSrc);
        for( key of Object.keys(popupData)){
          if(popupData[key]['popupName'] == popupName){            
            expression = '= ' + dynamicDialogTemplate({
              popupName : popupName,
              width : popupData[key]['width']? popupData[key]['width'] : '70%',
              height : popupData[key]['height'],
              minHeight :popupData[key]['minHeight']
            });
          };
        }
        importsComponent.add('import { DynamicDialogRef, DialogService } from \'primeng/dynamicdialog\';')
        constructorparameters.add('private dialogService: DialogService');
      }
      
      //To migrate multiple assignment statements present in single statement
      if(ctx.assignmentExpression() !== undefined && Array.isArray(ctx.assignmentExpression()) 
      && ctx.assignmentExpression().length == 1){
        if(expression != ''){
          let mig = handleAssignmentExpression(ctx.assignmentExpression()[0]);
          expression = expression + ' = ' + mig;
        }
      }
      if(handleAssExpCalls ==1){
        expression = expression.trim();
        if(expression.endsWith(';'))   {
          expression = expression.substring(0, expression.length-1);
        }
        let idRe = /this.[A-Za-z0-9_]+([.][A-Za-z0-9_]+)+[\s]*[!]?[=][\s]*[^=]+/g;
        let id = '';
        if(expression.match(idRe)){
          id = expression.split('=')[0].split('.')[1];
          let rest = '';
          if(expression.includes("!=")){
            rest = expression.split('!=')[0].split('.');
          }
          else if(expression.includes("=")){
            rest = expression.split('=')[0].split('.');
          }
          if(mxmlIdList.includes(id)){
            mxmlIds.forEach(ele =>{
              if (ele.id === id) {
                // console.log('aaaaaaaaaaaa1', expression, id, ele.tag);
                switch (ele.tag){
                  case 'mxButton' :
                    expression = handleMxButtonASAttributes(rest,expression);
                    break;
  
                  case 'mxLabel':
                    expression = handleMxLabelASAttributes(rest, expression);
                    break;
  
                  case 'mxAdvancedDataGrid':
                    expression = handleMxAdvanceDataGridASAttributes(rest, expression);
                    break;

                  case 'mxDataGrid':
                    expression = handleMxDataGridASAttributes(rest, expression);
                    break;
  
                  case 'mxComboBox':
                    expression = handleMxComboBoxASAttributes(rest, expression, id);
                    break;
  
                  case 'mxTextarea':
                    // console.log('aaaaaaaaaaaa', expression, id);
                    expression = handleMxTextAreaASAttributes(rest, expression);
                    break;
  
                  case 'mxTextInput':
                    expression = handleMxTextInputASAttributes(rest,expression, expression);
                    break;
  
                  case 'mxVRule':
                    expression = handleMxVRuleASAttributes(rest, expression, id);
                    break;
                  // Commented by Prasad
                  // case 'mxHTTPService':
                  //   expression = handleMxHTTPServiceASAttributes(rest, expression);
                  //   handleMxHTTPServiceASAttributes(rest, expression, services, fileName);
                  //   assignmentExpressionModified = true;
                  //   break;
  
                  // case 'mxViewStack':
                  //   modifiedRest = expression;
                  //   break;
                }
                // console.log('bbbbbbbbb', expression);
              }
            });
          }
        }      
      }
      if(handleAssExpCalls ==1 && !expression.trim().endsWith(';')){
        expression += ";";  
      }
      --handleAssExpCalls;  
      console.log("After handleAssignmentExpression @ return ", expression);
      return expression;  
    };

    console.log("\n Calling functions of AS3Listener");
    var KeyPrinter = function () {
      //console.log("Calling AS3Listener [dot]", this);
      AS3Listener.call(this); // inherit default listener
      //console.log("Returned from AS3Listener [dot]", this);
      return this;
    };
    //console.log("\n Creating KeyPrinter Object from AS3Listener");
    KeyPrinter.prototype = Object.create(AS3Listener.prototype);
    
    KeyPrinter.prototype.constructor = KeyPrinter;

    console.log("\n KeyPrinter Object Created");

    const handleCommentsOnRight = ctx => {
      var cmt = '';
      semi = ctx.stop.tokenIndex;
      ////console.log("asdasd semi",semi);
      cmtChannel = tokens.getHiddenTokensToRight(semi, lexer.COMMENTS);
      if (cmtChannel != null && cmtChannel.length > 0) {

        for (t of cmtChannel) {
          cmt = cmt + t.text//.trim();
          // //console.log("each toekn text======= "+t.text);
        }
        ////console.log("returened value--> "+cmt)
        if (!(cmt.length > 0))
          cmt = "";


      }
      return cmt;
    };


    const handleCommentsOnLeft = ctx => {
      var cmt = '';
      // //console.log("ctx get text ",ctx.getText())
      semi = ctx.start.tokenIndex;

      cmtChannel = tokens.getHiddenTokensToLeft(semi, lexer.COMMENTS);
      if (cmtChannel != null && cmtChannel.length > 0) {
        var cmt = '';
        for (t of cmtChannel) {
          cmt = cmt + t.text//.trim();
          // cmt="\n"+cmt+"\n";
          // //console.log("each toekn text======= "+t.text);
        }
        ////console.log("returened value--> "+cmt)
        if (!(cmt.length > 0))
          cmt = "";
        return cmt;

      }
      else {
        return '';
      }
	}

    KeyPrinter.prototype.enterStart = ctx => {
      //console.log("\n Inside enterStart");

      if (fs.readFileSync("mxmlIds.json", { encoding: "utf8" })) {
        mxmlIds = JSON.parse(
          fs.readFileSync("mxmlIds.json", { encoding: "utf8" })
        );
      }
      mxmlIds.forEach((ele) => {
        if (ele.tag !== "mxHTTPService") {
          variableDeclaration =
            variableDeclaration +
            '@ViewChild("' +
            ele.id +
            '", { static: true })\n' +
            ele.id +
            " : any;\n";
        }
      });
      console.log("\n After enterStart");
    };    

    KeyPrinter.prototype.enterVariableDefinition = ctx => {
      //console.log("\n Inside enterVariableDefinition");
      mode = "global";
      let declaration = true;
      let initialization = "";
      let orgInitialization = '';
      let type = "any";
      let dataType = "";
      let variableDeclareContent = "";
      //console.log("Variable:"+ctx.getText());
      if (mode != "global") {
        dataType = ctx.varOrConst().getText() + " ";
      }

      for (child of ctx.variableDeclarator()) {

        if (child.typeExpression() && child.typeExpression().identifier()) {
          if(child.getText().includes('PopUpManager.createPopUp')){
            type = typeChange('PopUpManager');
          }
          else{
            type = typeChange(child.typeExpression().identifier().getText());
          }
        }
        // //console.log("declared var ",child.ident().getText());
        variablesDeclared.push(child.ident().getText());
        variableDeclareContent =
          variableDeclareContent +
          dataType +
          child.ident().getText() +
          ": " +
          type;
        if (child.variableInitializer()) {
          declaration = false;
          if (child.variableInitializer().assignmentExpression())
            // initialization = child.variableInitializer().assignmentExpression().getText();
            // orgInitialization = getOriginalText(child.variableInitializer().assignmentExpression());
            // console.log('checkk0',child.variableInitializer().assignmentExpression().getText() )
            initialization = handleAssignmentExpression(child.variableInitializer());
            // console.log('checkk1', initialization);
        } else {
          variableDeclaration += variableDeclareContent + ";\n";
          variableDeclareContent=""
        }
      }

      //Class level variable declarations
      if (ctx.semi() && declaration) {
        variableDeclareContent = variableDeclareContent + "; \n";
      } 
      else {        
        variableDeclareContent =
          variableDeclareContent + ' = ' + initialization + " \n";
        if (mode == "global") {
          variableDeclaration = variableDeclaration + variableDeclareContent;
        } else if (mode == "function") {
          methodInitialization = methodInitialization + variableDeclareContent;
        }
      }
      console.log("\n After enterVariableDefinition");
    };

    
    const handleSwitchStatement = ctx => {
      console.log("\n Inside handleSwitchStatement");
      let switchStatement = "switch " + ctx.condition().getText() + "{\n";
      if (ctx.switchBlock().caseStatement()) {
        ctx
          .switchBlock()
          .caseStatement()
          .forEach((caseStmt) => {
            switchStatement +=
              "case " + caseStmt.expression().getText() + " :\n";

            switchStatement += handleCommentsOnLeft(caseStmt.switchStatementList()) + "\n"
            caseStmt
              .switchStatementList()
              .statement()
              .forEach(stmt => {

                switchStatement += handleStatement(stmt) + handleCommentsOnRight(stmt) + "\n";

              });
          });
      }
      if (ctx.switchBlock().defaultStatement()) {
        switchStatement += "default : \n";
        const defStmt = ctx.switchBlock().defaultStatement();
        defStmt
          .switchStatementList()
          .statement()
          .forEach(stmt => {
            switchStatement += handleStatement(stmt) + handleCommentsOnRight(stmt) + "\n";
          });
      }
      switchStatement += "}";
      console.log("\n After handleSwitchStatement");
      return switchStatement;
    };
    
    KeyPrinter.prototype.enterWithStatement = ctx => {
      //console.log("\n Inside enterWithStatement")
      let withStatements = "";
      let objectName;
      objectName = ctx.condition().expression().getText();
      for (statement of ctx.statement()) {
        withStatements +=
          "this." + objectName + "." + handleStatement(statement) + handleCommentsOnRight(statement) + "\n";
        //console.log("expression added after this@line 682", expression)
      }
      if (mode == "global") {
        variableDeclaration = variableDeclaration + withStatements;
      } else if (mode == "function") {
        methodInitialization = methodInitialization + withStatements;
      }
      console.log("\n After enterWithStatement");
    };

    KeyPrinter.prototype.enterImportDefinition = ctx => {
      if (!(ctx.getText().startsWith("importmx") || ctx.getText().startsWith("importflash"))) {
        var importedFileNameArray = ctx.getText().split(".");
        var importedFileName = importedFileNameArray[importedFileNameArray.length - 1].replace(";", "");
        var importStatement = `import { ${importedFileName} } from '../shared/helper/${importedFileName}';`;
        importsComponent.add(importStatement);
      }

    };
    
    const handleWhileStatement = ctx => {
      //console.log("\n Inside handleWhileStatement");
      let whileStatements = "while" + getOriginalText(ctx.condition()) + "{\n";
      whileStatements += handleCommentsOnLeft(ctx.statement(0)) + "\n";
      for (statement of ctx.statement()) {
        whileStatements += handleStatement(statement) + handleCommentsOnRight(statement) + "\n";
      }
      whileStatements += "}\n";
      console.log("\n After handleWhileStatement");
      return whileStatements;
    };  

    const handleIfStatement = ctx => {
      console.log("\n Inside handleIfStatement", ctx.getText());
      let ifStatementContent = "";
      let condition = handleAssignmentExpression(ctx.condition().expression());
      if(condition.endsWith(';')){
        condition = condition.substring(0, condition.length -1);
      }
      ifStatementContent =
        ifStatementContent + "if (" + condition + ")" + handleCommentsOnRight(ctx.condition()) + " {\n";
      if (ctx.statement().length > 0) {
        for (statement of ctx.statement()) {
          ifStatementContent =
            ifStatementContent + handleStatement(statement) + handleCommentsOnRight(statement) + "\n";
        }
      }

      if (ctx.elseClause()) {
        ifStatementContent = ifStatementContent + "} else ";
        if (!ctx.elseClause().getText().startsWith("elseif")) {
          ifStatementContent = ifStatementContent + "{\n";
        }
        if (ctx.elseClause().statement.length > 0) {
          for (statement of ctx.elseClause().statement()) {
            ifStatementContent =
              ifStatementContent + handleStatement(statement) + "\n";
          }
        }
        if (!ctx.elseClause().getText().startsWith("elseif")) {
          ifStatementContent += "}";
        }
      }
      else {
        ifStatementContent += "}\n ";
      }
      return ifStatementContent;
    };
    //console.log("\n After handleIfStatement");

    //console.log("\n Before handleForEachStatement");
    const handleForEachStatement = ctx => {
      //console.log("\n Inside handleForEachStatement");
      let condition = "";
      let expression = handleAssignmentExpression(
        ctx.forInClause().forInClauseTail().expressionList()
      );

      if (expression != "") {
        condition =
          getOriginalText(ctx.forInClause().forInClauseDecl()).split(":")[0] +
          ":" +
          typeChange(
            getOriginalText(ctx.forInClause().forInClauseDecl()).split(":")[1]
          ) +
          " of " +
          expression;
      } else {
        condition =
          getOriginalText(ctx.forInClause().forInClauseDecl()).split(":")[0] +
          ":" +
          typeChange(
            getOriginalText(ctx.forInClause().forInClauseDecl()).split(":")[1]
          ) +
          " of " +
          getOriginalText(ctx.forInClause().forInClauseTail());
      }
      let forEachStatements = "for (" + condition + ") {\n";
      forEachStatements += handleCommentsOnLeft(ctx.statement(0)) + "\n";
      for (statement of ctx.statement()) {
        forEachStatements += handleStatement(statement) + handleCommentsOnRight(statement) + "\n";
      }
      forEachStatements += "}\n";
      return forEachStatements;
    };

    const handleForStatement = ctx => {
      let forStatements = "";
      if( ctx.traditionalForClause())
        var initValue = ctx.traditionalForClause().forInit().getText().split("=");
      initValue[0] = initValue[0].split(":")[0];
      let cond = ctx.traditionalForClause().forCond().getText();
      let itera = ctx.traditionalForClause().forIter().getText();
      initValue = "var " + initValue[0].split("var")[1] + "=" + initValue[1];
      forStatements += `for(${initValue};${cond};${itera}){\n`
      for (statement of ctx.statement()) {
        forStatements += handleStatement(statement) + "\n";
      }
      forStatements += "}\n";
      return forStatements;
    }



    const handleTryStatement = ctx =>{

      tryStmts="try { \n"

      for (statement of ctx.block().blockEntry()) {
        comments = handleCommentsOnRight(statement.statement());
        tryStmts =        tryStmts +        handleStatement(statement.statement()) + comments + "\n";
      }
      tryStmts = tryStmts + "\n} ";

      

      catchStmt="";
      for( catchBlock of ctx.catchBlock()){
        catchStmt="catch(" +
                  catchBlock.ident().getText();
       
        catchStmt=catchStmt + ") { \n"
        for (statement of catchBlock.block().blockEntry()) {
            comments = handleCommentsOnRight(statement.statement());
            catchStmt =
            catchStmt +
              handleStatement(statement.statement()) + comments + "\n";
          }

        catchStmt+="} \n";

      }
      tryStmts+=catchStmt;

      finallyStmt=""
      if(ctx.finallyBlock()){
        finallyStmt+="finally { \n";
        for (statement of ctx.finallyBlock().block().blockEntry()) {
          comments = handleCommentsOnRight(statement.statement());
          finallyStmt =    finallyStmt +  handleStatement(statement.statement()) + comments + "\n";
        }
        finallyStmt+="}\n"
      }
      tryStmts+=finallyStmt;

      return tryStmts
  

     
    }

    KeyPrinter.prototype.enterTypeBlockEntry = ctx => {
      if (ctx.methodDefinition() != null)
        methodComments = handleCommentsOnLeft(ctx) + "\n";

    }



    KeyPrinter.prototype.enterClassDefinition = ctx => {
      if(ctx.classExtendsClause()){
       if(!(ctx.classExtendsClause().identifier().getText().includes("flash.events.EventDispatcher")
       ||ctx.classExtendsClause().identifier().getText().includes("mx.core.") ) )
          extendsClass=" extends "+ctx.classExtendsClause().identifier().getText();
        
        
      }

      if(ctx.implementsClause()){
        
         for(item of ctx.implementsClause().identifier()){
          if(!(item.getText().includes("flash.events.EventDispatcher")   || item.getText().includes("mx.core.") ) )
            implementsInterface+=item.getText();
          
         }
         if(implementsInterface.length>0)
          implementsInterface=" implements "+implementsInterface
      }

    }



    KeyPrinter.prototype.enterMethodDefinition = ctx => {
      if (count == 1) {
        methodInitialization = methodComments + methodInitialization;
        count = 2;
      } else {
        methodInitialization = methodInitialization + methodComments;
      }
      mode = "function";
      let returnType = " any ";
      let parameters = "";
      let parameterList = getOriginalText(ctx.parameterDeclarationList()).substr(1).slice(0, -1).split(",");
      for (parameter of parameterList) {
        if (parameter.split(":").length === 2) {
          
          let param = parameter.split(":")[0];
          if(parameter.includes(":ResultEvent")){
            resultEvent=parameter.split(":")[0]
            param="res"
          }
          let type = "";
          let value = "";
          if (parameter.split(":")[1].split("=").length === 2) {
            type = typeChange(parameter.split(":")[1].split("=")[0]);
            value = " = " + parameter.split(":")[1].split("=")[1];
          } else {
            type = typeChange(parameter.split(":")[1]);
          }
          parameters = parameters + param + " : " + type + value;
        } else {
          parameters = parameters + parameter;
        }
        if (parameterList.indexOf(parameter) !== parameterList.length - 1) {
          parameters = parameters + ",";
        }
      }
      if (ctx.typeExpression()) {
        returnType = typeChange(ctx.typeExpression().getText().substr(1));
      }
      var optionalAccessorRole="";
      if(ctx.optionalAccessorRole() !=null){
        optionalAccessorRole=ctx.optionalAccessorRole().getText();
      }
      
      if(fileName == ctx.ident().getText()){
        constructorInitialization="\n constructor() {"
        if (
          ctx.block() &&
          ctx.block().blockEntry() &&
          ctx.block().blockEntry().length > 0
        ) {
          constructorInitialization += handleCommentsOnLeft(ctx.block().blockEntry(0)) + "\n"
          for (statement of ctx.block().blockEntry()) {
            comments = handleCommentsOnRight(statement.statement());
            constructorInitialization =
            constructorInitialization +
              handleStatement(statement.statement()) + comments + "\n";
          }
        }

      }
      else{
          temp= ctx.parentCtx.modifiers().getText() +
          " " +
          optionalAccessorRole+
          " " +
          ctx.ident().getText() +
          " = (" +
          parameters +
          ") :" +
          returnType +
          " => { \n";

          if(optionalAccessorRole.length>0){
            temp=temp.replace("=","").replace("=>","")
            if(optionalAccessorRole.trim()=="set")
            temp=temp.replace("=","").replace(":any","")
          }

          methodInitialization =
            methodInitialization + temp
          
          methodInitialization = methodInitialization + "\n";
          if (
            ctx.block() &&
            ctx.block().blockEntry() &&
            ctx.block().blockEntry().length > 0
          ) {
            methodInitialization += handleCommentsOnLeft(ctx.block().blockEntry(0)) + "\n"
            for (statement of ctx.block().blockEntry()) {
              comments = handleCommentsOnRight(statement.statement());
              methodInitialization =
                methodInitialization +
                handleStatement(statement.statement()) + comments + "\n";
            }
          }
      }

    };

    //console.log("\n After enterMethodDefinition");

    //console.log("\n Before exitMethodDefinition");
    
    KeyPrinter.prototype.exitMethodDefinition = ctx => {
      //console.log("\n Inside exitMethodDefinition");
      mode = "global";
      methodInitialization = methodInitialization + "}\n";
      if(resultEvent.length>0)
      {
        const searchRegExp = new RegExp(resultEvent+".result", 'g');
        methodInitialization=methodInitialization.replace(searchRegExp,"res")
        resultEvent=""
      }
    };
    //console.log("\n After exitMethodDefinition");

    //console.log("\n Before exitStart");
    KeyPrinter.prototype.exitStart = () => {
      //console.log("\n Inside exitStart");
      // let source = fs.readFileSync(path.join(__dirname, '.' + outputTsPath));
      // source = source.toString();
      // let template = Handlebars.compile(source);
      // let contents = template({ variableDeclaration: variableDeclaration });
      // fs.writeFileSync(path.join(__dirname, '.' + outputTsPath), contents);
      fs.writeFileSync("mxmlIds.json", "");
      if (isExternalActionScript) {
        createHelperTs(
          fileName,
          importsComponent,
          variableDeclaration,
          constructorInitialization,
          methodInitialization,
          outputDirectory
        );
      } else {
        createComponent(
          fileName,
          tagName,
          componentName,
          lastFile,
          variableDeclaration,
          imports,
          routes,
          componentDeclarations,
          onInitInitialization,
          afterViewInitInitialization,
          methodInitialization,
          importsComponent,
          outputDirectory,
          constructorparameters,
          services,
          runId
        );


      }
    };
    //console.log("\n After exitStart");

    var KeyPrinterData = function () {
      AS3Listener.call(this); // inherit default listener
      return this;
    };
    KeyPrinterData.prototype = Object.create(AS3Listener.prototype);
    KeyPrinterData.prototype.constructor = KeyPrinterData;
    KeyPrinterData.prototype.enterStart = ctx =>{
      variableDataTypeMap = {};
    }
    KeyPrinterData.prototype.enterVariableDeclarator = ctx => {
      
      if(ctx.getText().includes('PopUpManager.createPopUp')){
        variableDataTypeMap[ctx.ident().getText()] = 'PopUpManager';
        popupData[ctx.ident().getText()] = {
          popupName : ctx.getText().split('=')[1].substring(0, ctx.getText().split('=')[1].indexOf('('))
        };
      }
      else{
        if(ctx.typeExpression()){
          variableDataTypeMap[ctx.ident().getText()] = ctx.typeExpression().identifier().getText();
        }
        else{
          variableDataTypeMap[ctx.ident().getText()] = 'any';
        }        
      }  
    }
    KeyPrinterData.prototype.enterAssignmentExpression = ctx => {
      if(ctx.getText().includes('=')){
        let lhs = ctx.getText().split('=')[0];
        let rhs = ctx.getText().split('=')[1];
        let re = /^[A-Za-z0-9_]+[.][A-Za-z0-9_]+$/g;
        // let matches = lhs.matchAll(re);
        let matches = [];
        do {
          match = re.exec(lhs);
          if (match) {
            matches.push(match);
          }
        } while (match);
        for(match of matches){
          if(popupData.hasOwnProperty(match[0].split('.')[0])){
            popupData[match[0].split('.')[0]][match[0].split('.')[1]] = rhs;
          }
        }
      }

    }
    KeyPrinterData.prototype.enterVariableDefinition = ctx => {
      for(decl of ctx.variableDeclarator()){
        classVariables.push(decl.ident().getText());
      }
    }
    KeyPrinterData.prototype.enterMethodDefinition = ctx => {
      methodNames.push(ctx.ident().getText());
    }

    console.log("\n Antlr : Starting to Parse", fileName);
    var tree = parser.start();
    console.log("\n Antlr : Parse Completed")
    console.log("\n Antlr : Walking Start");
    var populate = new KeyPrinterData();
    antlr4.tree.ParseTreeWalker.DEFAULT.walk(populate, tree);
    var printer = new KeyPrinter();
    antlr4.tree.ParseTreeWalker.DEFAULT.walk(printer, tree);
    //console.log("\n Antlr : Walking Completed");
  } // if(Scripts) => ends here. 

  else {
    //console.log("\n No scripts from .mxml files were found. Passing as file to createComponent method")
    fs.writeFileSync("mxmlIds.json", "");
    
    createComponent(
      fileName,
      tagName,
      componentName,
      lastFile,
      variableDeclaration,
      imports,
      routes,
      componentDeclarations,
      onInitInitialization,
      afterViewInitInitialization,
      methodInitialization,
      importsComponent,
      outputDirectory,
      constructorparameters,
      services,
      runId
    );

    

  }
};

const createComponent = (
  fileName,
  tagName,
  componentName,
  lastFile,
  variableDeclaration,
  imports,
  routes,
  componentDeclarations,
  onInitInitialization,
  afterViewInitInitialization,
  methodInitialization,
  importsComponent,
  outputDirectory,
  constructorparameters,
  services,
  runId
) => {
  let serviceName = `${fileName}Service`;
  let serviceVar = `${
    fileName.charAt(0).toLowerCase() + fileName.slice(1)
  }Service`;
  importsComponent.add("import { AppGlobal } from '../app-global';");
  importsComponent.add(
    `import { ${serviceName} } from './${fileName}.service'`
  );
  //Adding service objects
  let servceObjectSource = fs
    .readFileSync(path.join(__dirname, "../serviceTemplates/serviceObject.js"))
    .toString();
  let serviceObjectTemplate = Handlebars.compile(servceObjectSource);
  let serviceObjects = "";

  services[fileName].forEach((service) => {
    serviceObjects +=
      serviceObjectTemplate({
        id: service.id,
        url: service.url ? service.url : '""',
        method: `"${service.method}"`,
        // Regex : /^[^(]*/g is matching all characters until '('
        fault: service.fault
          ? `this.${service.fault.match(/^[^(]*/g)}(err)`
          : "",
        result: service.result
          ? `this.${service.result.match(/^[^(]*/g)}(res)`
          : "",
        serviceVar: serviceVar,
      }) + "\n";
  });
  variableDeclaration += serviceObjects;
  constructorparameters.add(`private ${serviceVar} : ${serviceName}`);
  let source = fs.readFileSync(
    path.join(__dirname, "../templateComponent/template.component.ts")
  );
  source = source.toString();
  let template = Handlebars.compile(source);
  
  if(methodInitialization.includes("Application.application")){
    methodInitialization = methodInitialization.replace(/Application.application/g,"AppGlobal")
  }
  if(variableDeclaration.includes("Application.application")){
    variableDeclaration = variableDeclaration.replace(/Application.application/g,"AppGlobal")
  }

  let contents = template({
    tagName: tagName,
    componentName: componentName,
    onInitInitialization: onInitInitialization,
    afterViewInitInitialization: afterViewInitInitialization,
    variableDeclaration: variableDeclaration,
    methodInitialization: methodInitialization,
    importsComponent: Array.from(importsComponent).join('\n'),//.toString(),//.replace(/,/g, "\n")
    constructorparameters: Array.from(constructorparameters).join(',\n'),
  });
  fs.writeFileSync(
    path.join(
      outputDirectory,
      "./src/app/" + fileName + "/" + fileName + ".component.ts"
    ),
    contents
  );
  createGlobalTs(
    importsComponent,
    variableDeclaration,
    methodInitialization,
    constructorparameters,
    outputDirectory
  );
  createService(
    fileName,
    tagName,
    componentName,
    imports,
    routes,
    componentDeclarations,
    outputDirectory,
    services,
    runId
  );
  if (lastFile) {
    editingDependecies(
      imports,
      routes,
      componentDeclarations,
      outputDirectory,
      services,
      runId
    );
  }
};

const createService = (
  fileName,
  tagName,
  componentName,
  imports,
  routes,
  componentDeclarations,
  outputDirectory,
  services,
  runId
) => {
  let serviceName = fileName + "Service";
  let methods = "";
  source = fs.readFileSync(
    path.join(__dirname, "../templateComponent/template.service.ts")
  );
  methodSource = fs
    .readFileSync(path.join(__dirname, "../serviceTemplates/serviceMethod.js"))
    .toString();
  services[fileName].forEach((service) => {
    let methodTemplate = Handlebars.compile(methodSource);
    methods += methodTemplate({ methodName: service.id }) + "\n";
  });
  source = source.toString();
  template = Handlebars.compile(source);
  contents = template({ serviceName, methods });
  fs.writeFileSync(
    path.join(
      outputDirectory,
      "./src/app/" + fileName + "/" + fileName + ".service.ts"
    ),
    contents
  );
  let importString =
    "import { " +
    componentName +
    " } from './" +
    fileName +
    "/" +
    fileName +
    ".component';";

  imports.push(importString);
  //Adding service file for component
  importString =
    "import { " +
    serviceName +
    " } from './" +
    fileName +
    "/" +
    fileName +
    ".service';";

  imports.push(importString);
  componentDeclarations.push(componentName);
  routes.push(
    "{ path : '" + tagName + "', component : " + componentName + " }"
  );
};

const editingDependecies = (
  imports,
  routes,
  componentDeclarations,
  outputDirectory,
  services,
  runId
) => {
  ////console.log(services);
  let source, template, contents;
  //Editing ModuleTs
  source = fs.readFileSync(
    path.join(outputDirectory, "./src/app/app.module.ts")
  );
  source = source.toString();
  template = Handlebars.compile(source);
  contents = template({
    imports: imports.toString().replace(/,/g, "\n"),
    componentDeclarations: componentDeclarations,
    serviceNames: Object.keys(services).length
      ? `, ${Object.keys(services)}`
      : "",
  });

  fs.writeFileSync(
    path.join(outputDirectory, "./src/app/app.module.ts"),
    contents
  );
  //Editing Routing File
  source = fs.readFileSync(
    path.join(outputDirectory, "./src/app/app-routing.module.ts")
  );
  source = source.toString();
  template = Handlebars.compile(source);

  contents = template({
    imports: imports.toString().replace(/,/g, ""),
    routes: routes.toString(),
  });
  fs.writeFileSync(
    path.join(outputDirectory, "./src/app/app-routing.module.ts"),
    contents
  );

  // let globalVariables = JSON.parse(
  //   fs.readFileSync("globalVariables.json", { encoding: "utf8" })
  // );
  // let globalVariableString = "";
  // for (gvar of globalVariables) {
  //   globalVariableString += gvar + "\n";
  // }
  // source = fs.readFileSync(
  //   path.join(outputDirectory, "./src/app/app-global.ts")
  // );
  // source = source.toString();
  // template = Handlebars.compile(source);

  // if(global.appGlobalTs==true){
  //   contents = template({
  //     importsComponent:
  //     variableDeclaration: globalVariableString
  //     methodInitialization
  //   });
  //   fs.writeFileSync(
  //     path.join(outputDirectory, "./src/app/app-global.ts"),
  //     contents
  //   );
  // }

  fs.mkdirSync(path.join(outputDirectory, "./logs"));
  fs.writeFileSync(
    path.join(outputDirectory, "./logs/" + "log.html"),
    "Migration process completed"
  );
  setTimeout(() => {
    saveContexts(runId);
  }, 1000);

  // //console.log("Done");
};

const createHelperTs = (
  fileName,
  importsComponent,
  variableDeclaration,
  constructorInitialization,
  functionDefinition,
  outputDirectory
) => {

  helperName = fileName;
  if(importsComponent==null)
    importsComponent=[]
  let source = fs.readFileSync(
    path.join(__dirname, "../templateHelper/template.ts")
  );
  source = source.toString();
  let template = Handlebars.compile(source);
  if(functionDefinition.includes("Application.application")){
    functionDefinition = functionDefinition.replace(/Application.application/g,"AppGlobal")
  }
  if(variableDeclaration.includes("Application.application")){
    variableDeclaration = variableDeclaration.replace(/Application.application/g,"AppGlobal")
  }
  let contents = template({
    helperName: helperName,
    importsComponent: Array.from(importsComponent).join('\n'),//.toString(),//.replace(/,/g, "\n")
    variableDeclaration: variableDeclaration,
    constructorInitialization: constructorInitialization,
    functionDefinition: functionDefinition,
    extendsClass:extendsClass,
    implementsInterface:implementsInterface
  });

  if (!fs.existsSync(path.join(outputDirectory, "./src/app/shared/helper/"))) {
    fs.mkdirSync(path.join(outputDirectory, "./src/app/shared/helper/"), {
      recursive: true,
    });
  }
  fs.writeFileSync(
    path.join(outputDirectory, "./src/app/shared/helper/" + fileName + ".ts"),
    contents
  );
};

const createGlobalTs = (
  importsComponent,
  variableDeclaration,
  methodInitialization,
  constructorparameters,
  outputDirectory
) => {
  let source, template, contents;
  
  let globalVariables = JSON.parse(
    fs.readFileSync("globalVariables.json", { encoding: "utf8" })
  );
  let globalVariableString = "";
  for (gvar of globalVariables) {
    globalVariableString += gvar + "\n";
  }
  source = fs.readFileSync(
    path.join(outputDirectory, "./src/app/app-global.ts")
  );
  source = source.toString();
  template = Handlebars.compile(source);
  if(methodInitialization.includes("Application.application")){
    methodInitialization = methodInitialization.replace(/Application.application/g,"AppGlobal")
  }
  if(variableDeclaration.includes("Application.application")){
    variableDeclaration = variableDeclaration.replace(/Application.application/g,"AppGlobal")
  }
  if (global.appGlobalTs) {
    contents = template({
      importsComponent: Array.from(importsComponent).join('\n'),//.toString(),//.replace(/,/g, "\n")
      variableDeclaration: variableDeclaration,
      methodInitialization: methodInitialization,
      constructorparameters:Array.from(constructorparameters).join(',\n')
    });
  }

  fs.writeFileSync(
    path.join(outputDirectory, "./src/app/app-global.ts"),
    contents
  );
};
