import { Opportunity, PrismaClient } from "@prisma/client";
import { CustomField } from "@src/types/custom-field";

function createCSVRowFromOpportunityData(
  opportunity: Opportunity,
  workspaceCustomFields: CustomField[]
) {
  const opportunityData = JSON.parse(opportunity.opportunityData);
  const row =
    opportunity.title +
    "," +
    // For each custom field defined in the workspace, look up the value
    // for that field in the opportunity data and add it to the CSV row
    workspaceCustomFields
      .map((field: CustomField) => {
        const fieldValue = opportunityData[field.id];
        // If the opportunity does not have a value for this field, return "N/A"
        if (!fieldValue) {
          return "N/A";
        }

        if (field.type === "multi-dropdown") {
          //console.log("MATCHED LABEL:", field.options?.find((option) => option.value === fieldValue.value.value)?.label);
          return field.options?.find((option) => option.value === fieldValue.value.value)?.label;//fieldValue.value.label;
        } else if (field.type === "date") {
          return fieldValue.value;
        } else {
          return "N/A";
        }
      })
      .join(",");

  return row;
}

export async function exportWorkspaceOpportunitiesToCSV(prisma: PrismaClient) {
  const workspace = await prisma.workspace.findFirst();

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const workspaceCustomFields: CustomField[] = JSON.parse(
    workspace.customFieldDefinition
  );
  const opportunities = await prisma.opportunity.findMany();

  const headerCSV =
    "Title," +
    workspaceCustomFields.map((field: CustomField) => field.name).join(",");

  const opportunitiesCSV = opportunities
    .map((opportunity) => {
      const row = createCSVRowFromOpportunityData(
        opportunity,
        workspaceCustomFields
      );
      return row;
    })
    .join("\n");

  return headerCSV + "\n" + opportunitiesCSV;
}


export type Filter = {
  id: string;
  type: string;
  value: string;
}
export async function filterOpportunities(prisma: PrismaClient, filters: Filter[]) {
 /**
  *   filters: [{id: 'customField1', type: 'multi-dropdown', value: 'Option 1'}, {id: 'description', type: 'short-text', value: 'typ'}]
  *   1. For each filter
  *     Determine if text or options type field
  *     if text, do a type-ahead lookup
  *     if options (dropdown, multi-dropdown or a custom field of these types), add a condition to the query to filter by the value
  * 
  * 
  * 
  */
  // This is just for illustration purpose, Copilot++ implementation, based on the above.
  // not tested.

  // Constructing the where clause for Prisma query based on filters
  const whereClause: any = {};

  filters.forEach(filter => {
    if (filter.type === 'short-text'||filter.type === 'name') {
      // Assuming 'opportunityData' is a JSON field and we use a JSON path to filter
      whereClause[`opportunityData.${filter.id}`] = {
        contains: filter.value,
        mode: 'insensitive'
      };
    } else if (['dropdown', 'multi-dropdown'].includes(filter.type)) {
      // Exact match for dropdown types
      whereClause[`opportunityData.${filter.id}.value`] = filter.value;
    }
  });

  // Fetching opportunities based on the constructed where clause
  const opportunities = await prisma.opportunity.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      opportunityData: true
    }
  });

  return opportunities;
}

export async function generateHints(prisma: PrismaClient) {
  /**
   * 1. Translated reqs: return possible values for custom fields of 
   * dropdown, multi-dropdown,short-text, name types.
   * Question: what about standard fields of those types?
   * If we limit to custom fields, then we only need to return options based on custom field definitions.
   * Otherwise we need to search the DB for actual opportunities, collecting distinct values for the fields of those types.
   * 
   * Need to consider the scale, how many opportunities are in the DB for each workspace? Can we even load all of them in memory?
   * Assumption: we can load all of them in memory.
   * 
   * 
   * Question: is "name" a standard field type? Assuming yes for now.
   * Question: what is a plausible hint for a text field? 
   * Possibles: a) collect all distinct values for short-text and name fields.
   * b) just return text saying start typing to see suggestions.
   * 
   * Assumptions made for this task:
   * 1. "name" is a standard field type.
   * 2.  We return json containing all fields of required types  (dropdown, multi-dropdown,short-text, name)
   *     if dropdown or multi-dropdown, we return all distinct values for that field.
   *     if short-text or name, we just indicate type.
   *
   * We will create a search function that takes a field id and a filter value for dropdowns, or type-ahead string
   * for short-text and name fields.
   * 
   * 
   * 
   */

  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const workspaceCustomFields: CustomField[] = JSON.parse(
    workspace.customFieldDefinition
  );
  const opportunities = await prisma.opportunity.findMany({
    select: {
      opportunityData: true
    }
  });

  const allowedFieldTypes = ['dropdown', 'multi-dropdown', 'short-text', 'name'];

  type FieldDef = {
    name:string;
    type: string;
    values: Set<string>;
  }
  type DistinctFields = {
    [key: string]: FieldDef
  }
  let distinctFields: DistinctFields = {};

  function addFieldValue(id: string, type: string, value: string) {
    let name = id;
    const customField = workspaceCustomFields.find(cf => cf.id === id);
    if (customField) {
      console.log("Matching Custom Field Name:", customField.name);
      name = customField.name; // Replace id with the name from workspaceCustomFields
    }

    if (distinctFields[id]&&(['dropdown','multi-dropdown'].indexOf(distinctFields[id].type)>=0)) {
      distinctFields[id].values.add(value);
    } else {
      distinctFields[id] = { name: name, type: type, values: new Set([value]) };
    }
  }
  opportunities.forEach(opportunity=>{
    const data = JSON.parse(opportunity.opportunityData);
    console.log("Data=>",data);
    Object.keys(data).forEach(id=>{
      const {value,type} = data[id]; 
      if(value&&(allowedFieldTypes.indexOf(type)>=0)){
        addFieldValue(id,type,value.label);
      }
    })
  })

  console.log("Hints=>", distinctFields);

  /*const opportunities = await prisma.opportunity.findMany({ where:{
    id:workspaceid
  }});
  console.log("Opportunities=>",opportunities);*/
  return JSON.stringify(distinctFields);

}
