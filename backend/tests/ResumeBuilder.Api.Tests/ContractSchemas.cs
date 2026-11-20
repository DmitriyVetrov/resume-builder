using System.Text.Json.Nodes;
using Json.Schema;
using YamlDotNet.Serialization;

namespace ResumeBuilder.Api.Tests;

internal static class ContractSchemas
{
  private static readonly string Contract = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../..", "contracts/openapi/openapi.yaml"));

  public static bool IsValid(string schemaName, string body)
  {
    var yaml = new DeserializerBuilder().Build().Deserialize<object>(File.ReadAllText(Contract));
    var json = new SerializerBuilder().JsonCompatible().Build().Serialize(yaml);
    var document = JsonNode.Parse(json) ?? throw new InvalidOperationException("Contract JSON is empty");
    var definitions = document["components"]?["schemas"] ?? throw new InvalidOperationException("Contract schemas missing");
    if (definitions[schemaName] is null) throw new InvalidOperationException($"Contract schema missing: {schemaName}");
    var root = new JsonObject { ["$ref"] = $"#/$defs/{schemaName}", ["$defs"] = definitions.DeepClone() };
    NormalizeYamlScalars(root);
    var schema = JsonSchema.FromText(root.ToJsonString());
    return schema.Evaluate(JsonNode.Parse(body)).IsValid;
  }

  public static string ExampleJson(string name)
  {
    var yaml = new DeserializerBuilder().Build().Deserialize<object>(File.ReadAllText(Contract));
    var json = new SerializerBuilder().JsonCompatible().Build().Serialize(yaml);
    var document = JsonNode.Parse(json) ?? throw new InvalidOperationException("Contract JSON is empty");
    var value = document["components"]?["examples"]?[name]?["value"] ?? throw new InvalidOperationException($"Contract example missing: {name}");
    NormalizeYamlScalars(value);
    return value.ToJsonString();
  }

  private static void NormalizeYamlScalars(JsonNode node)
  {
    if (node is JsonArray array) { foreach (var item in array) if (item is not null) NormalizeYamlScalars(item); return; }
    if (node is not JsonObject obj) return;
    foreach (var entry in obj.ToArray())
    {
      if (entry.Value is null) continue;
      if ((entry.Key is "maxLength" or "minLength" or "maximum" or "minimum" or "exclusiveMinimum" or "exclusiveMaximum" or "multipleOf" or "maxItems" or "minItems" or "maxProperties" or "minProperties" or "status") && decimal.TryParse(entry.Value.ToString(), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var number)) obj[entry.Key] = number;
      else if ((entry.Key is "additionalProperties" or "uniqueItems" or "readOnly" or "writeOnly" or "deprecated") && bool.TryParse(entry.Value.ToString(), out var boolean)) obj[entry.Key] = boolean;
      else if (entry.Key == "$ref") obj[entry.Key] = entry.Value.ToString().Replace("#/components/schemas/", "#/$defs/", StringComparison.Ordinal);
      else NormalizeYamlScalars(entry.Value);
    }
  }
}
