$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$imageRoot = Join-Path $projectRoot "public\item-images"

$map = @{
  "(sweet) rock melon" = "rock-melon"; "apple green" = "green-apple";
  "asparagus (small size)" = "asparagus-small"; "asparagus jampo" = "asparagus-jumbo";
  "avocado" = "avocado"; "avocado hass" = "avocado-hass"; "baby potato" = "baby-potato";
  "baby rocca" = "baby-rocca"; "baby spinach" = "baby-spinach"; "banana" = "banana";
  "basil leaves" = "basil"; "beetroot" = "beetroot"; "black berry" = "blackberry";
  "blue berry" = "blueberry"; "brocoli fresh" = "broccoli"; "carrot" = "carrot";
  "cauliflower" = "cauliflower"; "celery stick" = "celery"; "chard" = "chard";
  "cherry tomato" = "cherry-tomato"; "corinder leaves" = "coriander"; "cucumber" = "cucumber";
  "curry leaves" = "curry-leaves"; "dill leaves" = "dill"; "eggplant" = "eggplant";
  "english parsley" = "english-parsley"; "fresh orange" = "orange"; "garlic" = "garlic";
  "garlic bag" = "garlic-bag"; "ginger box" = "ginger-box"; "ginger fresh" = "ginger";
  "green bell pepper" = "green-bell-pepper"; "green chilli" = "green-chilli";
  "iceberg lettuce" = "iceberg-lettuce"; "jalapeno green" = "jalapeno"; "kiwi" = "kiwi";
  "lady finger" = "okra"; "leeks" = "leeks"; "lemon" = "lemon";
  "lemongrass" = "lemongrass"; "lime" = "lime"; "long green chilly" = "long-green-chilli";
  "looky" = "bottle-gourd"; "mandarine" = "mandarin"; "mango" = "mango";
  "mint leaves" = "mint"; "mushroom" = "mushroom"; "pakistani potato" = "pakistani-potato";
  "parsley leaves" = "parsley"; "pineapple" = "pineapple"; "pomegranate" = "pomegranate";
  "pomegrante box" = "pomegranate-box"; "potato" = "potato"; "red bell pepper" = "red-bell-pepper";
  "red cabage" = "red-cabbage"; "red grapes" = "red-grapes"; "red onion" = "red-onion";
  "red radish" = "red-radish"; "reed apple" = "red-apple"; "reed grapes" = "red-grapes-alt";
  "romani lettuce" = "romaine-lettuce"; "rosemarry" = "rosemary"; "spring onion" = "spring-onion";
  "strawberry" = "strawberry"; "strawberry american" = "strawberry-punnet";
  "sweet potato" = "sweet-potato"; "thyme" = "thyme"; "tomato" = "tomato";
  "white cabbage" = "white-cabbage"; "white onion" = "white-onion";
  "yellow bell pepper" = "yellow-bell-pepper"; "zucchini / marrow" = "zucchini";
}

Push-Location $projectRoot
try {
  $itemsJson = npx convex run --inline-query "const rows = await ctx.db.query('items').collect(); return rows.filter(x => x.active).map(x => ({id:x._id,nameEn:x.nameEn,unit:x.unit})).sort((a,b)=>a.nameEn.localeCompare(b.nameEn));"
  $items = $itemsJson | ConvertFrom-Json
  $missing = @($items | Where-Object { -not $map.ContainsKey($_.nameEn.Trim().ToLowerInvariant()) })
  if ($missing.Count) { throw "Missing mappings: $($missing.nameEn -join ', ')" }

  $urlsJson = npx convex run itemImageSeed:generateUploadUrls (ConvertTo-Json @{ count = $items.Count } -Compress)
  $urls = $urlsJson | ConvertFrom-Json
  $links = @()

  function Attach-Batch([array]$batch) {
    if (-not $batch.Count) { return }
    $payload = ConvertTo-Json @{ images = $batch } -Compress -Depth 4
    $escapedPayload = $payload.Replace('"', '\"')
    npx convex run itemImageSeed:attachMany $escapedPayload
    if ($LASTEXITCODE -ne 0) { throw "Failed to attach image batch" }
  }

  for ($i = 0; $i -lt $items.Count; $i++) {
    $item = $items[$i]
    $key = $item.nameEn.Trim().ToLowerInvariant()
    $file = Join-Path $imageRoot ($map[$key] + ".webp")
    $uploaded = Invoke-RestMethod -Uri $urls[$i] -Method Post -ContentType "image/webp" -InFile $file
    $links += @{ itemId = $item.id; storageId = $uploaded.storageId }
    if ($links.Count -eq 10) {
      Attach-Batch $links
      $links = @()
    }
    Write-Progress -Activity "Uploading item images" -Status "$($i + 1) / $($items.Count): $($item.nameEn)" -PercentComplete ((($i + 1) / $items.Count) * 100)
  }

  Attach-Batch $links
}
finally { Pop-Location }
