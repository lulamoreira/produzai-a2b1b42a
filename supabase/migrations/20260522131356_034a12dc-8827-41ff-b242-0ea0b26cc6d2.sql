-- Step 1: Create a reusable title case function
CREATE OR REPLACE FUNCTION to_title_case(input TEXT)
RETURNS TEXT AS $$
  SELECT string_agg(initcap(word), ' ')
  FROM unnest(string_to_array(trim(regexp_replace(input, '\s+', ' ', 'g')), ' ')) AS word
  WHERE word != '';
$$ LANGUAGE SQL IMMUTABLE;

-- Step 2: Update ALL existing campaign names to Title Case
UPDATE campaigns
SET name = to_title_case(name)
WHERE name IS NOT NULL AND name != '';

-- Step 3: Create trigger function to auto-apply on INSERT and UPDATE
CREATE OR REPLACE FUNCTION enforce_campaign_title_case()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL AND NEW.name != '' THEN
    NEW.name := to_title_case(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Attach trigger to campaigns table
DROP TRIGGER IF EXISTS trg_campaign_title_case ON campaigns;
CREATE TRIGGER trg_campaign_title_case
BEFORE INSERT OR UPDATE OF name ON campaigns
FOR EACH ROW
EXECUTE FUNCTION enforce_campaign_title_case();