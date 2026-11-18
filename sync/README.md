# Mavi Finans 2.0 — Deneysel eşitleme çekirdeği

Bu klasör **canlı uygulamaya bağlı değildir**. Finansal veri aktarımı, cihaz eşleştirmesi veya mevcut kasayı değiştirme işlemi gerçekleştirmez.

## Amaç

İki cihazın aynı başlangıç kasasından türemesi halinde işlemleri kimlikleriyle karşılaştırarak, farklı cihazlardaki kayıtların **üzerine yazmadan** birleştirilip birleştirilemeyeceğini önizlemek.

- Mükerrer kimlikler reddedilir.
- Bir cihazda eklenen bağımsız kayıtlar önizlemede birlikte görünür.
- Silme işlemi, eski kayıtları ikinci cihazdan geri getirmemelidir.
- Aynı kayıt iki tarafta farklı düzenlendiyse otomatik tercih yapılmaz.
- Başka bir kasa veya uyuşmayan ortak başlangıç reddedilir.
- Referansları bozuk kayıtlar engellenir.
- Birleştirme önizlemesi gerçek kasaya **otomatik yazılmaz**.

## Yerel test

Node.js 20 veya üzeri ortamında:

```sh
node --test sync/merge-core.test.cjs
```

Bu testlerin kaynak dosyaları eklenmiştir; CI kurulmadan GitHub'a yüklenmiş olması otomatik olarak testlerin çalıştırıldığı anlamına gelmez.

## Güvenlik ve henüz tamamlanmayan işler

1. Mevcut `app.js`, IndexedDB içindeki kasayı AES-GCM ile şifreli tutuyor. Şifreli yedek geri yüklemesi **üzerine yazar**. Bu prototip henüz bu işleyişe bağlanmadı.
2. Eski cihazlardaki ayrı kasalar rastgele hesap kimlikleriyle oluşturulmuş olabilir. Birbirinden bağımsız açılan kasaların topluca birleştirilmesi, aynı isimli kasa/banka hesaplarının iki kez sayılmasına yol açabilir. Bu yüzden ortak başlangıç kimliği gereklidir.
3. Cihazlar arasında kimlik doğrulamalı şifreli aktarım, QR eşleştirme, kısa süreli anahtarlar, ağ izinleri, yeniden oynatma önleme, izne bağlı oturumlar ve kullanıcı onayı henüz yoktur.
4. Her eşitlemede bütün işlemlerin otomatik yeniden birleştirilmesi doğru değildir. Başarılı bir eşitlemeden sonra iki cihazın da ortak temelini atomik olarak ilerleten protokol gerekiyor.
5. Özellikle iki cihazın çevrimdışı kaldığı sırada aynı kaydı düzenlemesi/silmesi, hesap bakiyesini güncellemesi ve borç tahsilatını değiştirmesi için ek uç durum testleri gerekir.
6. Herhangi bir aktarım öncesi **her iki cihazın ayrı ayrı şifreli yedeği** alınmalıdır. Hiçbir gerçek finans kaydı veya yedek dosyası GitHub'a yüklenmemelidir.
7. GitHub Pages tek başına iPhone ile Windows arasında doğrudan eşitleme sunucusu çalıştıramaz. Yerel ağ üzerinden doğrudan haberleşme ve iOS tarayıcı/PWA kısıtları ayrıca değerlendirilmelidir.

## Yayın durumu

Bu dal **deneysel** bir taslaktır. `main` dalı ve canlı GitHub Pages uygulaması değiştirilmez. Birleştirme sonucunu yalnızca test verileriyle doğrulamadan ve kapsamlı testlerden geçirmeden gerçek kasaya uygulamayın.
